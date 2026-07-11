"use client";

/**
 * Comandos logisticos atomicos (fase 4 de la remediacion de concurrencia).
 *
 * En modo Supabase, las operaciones criticas de stock dejan de ser
 * leer-modificar-escribir en el navegador y pasan a funciones SQL del
 * proyecto compartido (merchanops/supabase/v8_2_logistics_commands.sql):
 * bloqueo de fila (FOR UPDATE), validacion de precondiciones, y movimiento +
 * saldo en LA MISMA transaccion. Dos usuarios no pueden reservar las mismas
 * unidades; el que llega tarde recibe un error claro en vez de pisar datos.
 */

import { supabase } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** true si la operacion debe ir por el comando atomico del DB compartido. */
export function atomicCommandsAvailable(id: string): boolean {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" && Boolean(supabase) && UUID_RE.test(id);
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await supabase!.rpc(fn, args);
  if (error) {
    // El mensaje del DB ya es explicativo (stock insuficiente, conflicto de
    // version, transicion prohibida...). Se propaga sin degradar a "guardado".
    throw new Error(error.message);
  }
}

export async function reserveStockAtomic(materialId: string, quantity: number, reason: string, actor?: string | null): Promise<void> {
  await rpc("logistics_reserve_stock", {
    p_material_id: materialId,
    p_qty: quantity,
    p_motivo: reason,
    p_actor: actor ?? null
  });
}

export async function releaseReservationAtomic(materialId: string, quantity: number, reason: string, actor?: string | null): Promise<void> {
  await rpc("logistics_release_reservation", {
    p_material_id: materialId,
    p_qty: quantity,
    p_motivo: reason,
    p_actor: actor ?? null
  });
}

export async function closePickingAtomic(pickingId: string, actor?: string | null): Promise<void> {
  await rpc("logistics_close_picking", { p_picking_id: pickingId, p_actor: actor ?? null });
}

export async function shipPickingAtomic(pickingId: string, carrier?: string | null, actor?: string | null): Promise<void> {
  await rpc("logistics_ship_picking", { p_picking_id: pickingId, p_transportista: carrier ?? null, p_actor: actor ?? null });
}

export async function confirmDeliveryAtomic(shipmentId: string, actor?: string | null): Promise<void> {
  await rpc("logistics_confirm_delivery", { p_shipment_id: shipmentId, p_actor: actor ?? null });
}

export async function rejectRequestAtomic(requestId: string, reason: string, actor?: string | null): Promise<void> {
  await rpc("logistics_reject_request", { p_request_id: requestId, p_reason: reason, p_actor: actor ?? null });
}
