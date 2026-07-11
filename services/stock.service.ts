/**
 * Servicio de stock y movimientos.
 *
 * REGLA CRITICA DE STOCK (fase 2):
 * - El stock fisico (`currentStock`) SOLO se descuenta al **cerrar el picking**
 *   (movimiento `salida_picking`), nunca al crear el picking ni al preparar.
 * - Al crear un picking se **reserva** (`reservedStock += qty`, movimiento
 *   `reserva`); esto no toca el stock fisico pero refleja compromiso.
 * - Stock disponible = `currentStock - reservedStock`.
 * - Toda variacion de stock pasa por este servicio y genera un `StockMovement`,
 *   de modo que el historico siempre cuadra con el stock.
 */

import { Material, StockMovement, StockMovementType, RelatedEntityType } from "@/types";
import { getAdapter } from "@/services/adapter";
import { atomicCommandsAvailable, releaseReservationAtomic, reserveStockAtomic } from "@/services/atomic-commands";
import { makeCrud } from "@/services/crud";
import { nowIso } from "@/lib/dates";

const movementsCrud = makeCrud("stockMovements", "mov");

export const listMovements = () => movementsCrud.list();

/** Stock realmente disponible (fisico menos reservado). */
export function availableStock(material: Material): number {
  return material.currentStock - (material.reservedStock ?? 0);
}

export interface MovementInput {
  materialId?: string | null;
  materialItemId?: string | null;
  clientId?: string | null;
  campaignId?: string | null;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  fromLocation?: string | null;
  toLocation?: string | null;
  relatedEntityType?: RelatedEntityType | null;
  relatedEntityId?: string | null;
  actorId?: string | null;
}

/** Registra un movimiento SIN alterar stock (uso interno y trazabilidad). */
async function writeMovement(input: MovementInput): Promise<StockMovement> {
  const adapter = getAdapter();
  const material = input.materialId ? await adapter.get("materials", input.materialId) : null;
  return movementsCrud.create(
    {
      materialId: input.materialId ?? null,
      clientId: input.clientId ?? material?.clientId ?? null,
      campaignId: input.campaignId ?? material?.campaignId ?? null,
      type: input.type,
      quantity: input.quantity,
      fromLocation: input.fromLocation ?? null,
      toLocation: input.toLocation ?? null,
      reason: input.reason ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null
    },
    input.actorId
  );
}

export const recordMovement = writeMovement;

export interface StockChange {
  materialId: string;
  /** Delta a aplicar al stock fisico (positivo suma, negativo resta). */
  delta: number;
  type: StockMovementType;
  reason?: string;
  fromLocation?: string | null;
  toLocation?: string | null;
  relatedEntityType?: RelatedEntityType | null;
  relatedEntityId?: string | null;
  actorId?: string | null;
}

/**
 * Aplica un cambio al stock FISICO de un material y registra el movimiento.
 * Se usa para entradas (`entrada`), ajustes (`ajuste`), devoluciones y para el
 * consumo al cerrar picking (`salida_picking`). No permite stock negativo.
 */
export async function applyStockDelta(change: StockChange): Promise<{ material: Material; movement: StockMovement }> {
  const adapter = getAdapter();
  const material = await adapter.get("materials", change.materialId);
  if (!material) throw new Error(`Material ${change.materialId} no encontrado`);

  const nextStock = material.currentStock + change.delta;
  if (nextStock < 0) {
    throw new Error(
      `Stock insuficiente para "${material.name}" (actual ${material.currentStock}, solicitado ${Math.abs(change.delta)})`
    );
  }

  const status = deriveMaterialStatus(nextStock, material.minimumStock, material.status);
  const updatedMaterial = await adapter.update("materials", material.id, {
    currentStock: nextStock,
    status,
    updatedAt: nowIso(),
    updatedBy: change.actorId ?? null
  });

  const movement = await writeMovement({
    materialId: material.id,
    clientId: material.clientId,
    campaignId: material.campaignId ?? null,
    type: change.type,
    quantity: Math.abs(change.delta),
    reason: change.reason,
    fromLocation: change.fromLocation,
    toLocation: change.toLocation,
    relatedEntityType: change.relatedEntityType,
    relatedEntityId: change.relatedEntityId,
    actorId: change.actorId
  });

  return { material: updatedMaterial, movement };
}

/**
 * Reserva stock (compromiso por un picking abierto). NO toca el stock fisico;
 * incrementa `reservedStock` y registra un movimiento `reserva`. Bloquea si la
 * reserva supera el stock disponible (`fisico - reservado`) para mantener la
 * coherencia de la regla: disponible = fisico - reservado nunca debe ser < 0.
 */
export async function reserveStock(
  materialId: string,
  quantity: number,
  relatedEntityId: string,
  actorId?: string | null
): Promise<Material> {
  if (quantity <= 0) return getRequiredMaterial(materialId);
  if (!Number.isFinite(quantity)) throw new Error(`Cantidad de reserva invalida: ${quantity}`);

  // Modo Supabase: comando atomico en PostgreSQL (FOR UPDATE + movimiento y
  // saldo en la misma transaccion). Evita la carrera de dos usuarios
  // reservando las mismas unidades a la vez.
  if (atomicCommandsAvailable(materialId)) {
    await reserveStockAtomic(materialId, quantity, `Reserva por picking ${relatedEntityId}`, actorId);
    return getRequiredMaterial(materialId);
  }

  const adapter = getAdapter();
  const material = await adapter.get("materials", materialId);
  if (!material) throw new Error(`Material ${materialId} no encontrado`);

  const available = availableStock(material);
  if (quantity > available) {
    throw new Error(
      `Stock disponible insuficiente para reservar "${material.name}" (disponible ${available}, solicitado ${quantity})`
    );
  }

  const updated = await adapter.update("materials", materialId, {
    reservedStock: (material.reservedStock ?? 0) + quantity,
    updatedAt: nowIso(),
    updatedBy: actorId ?? null
  });
  await writeMovement({
    materialId,
    type: "reserva",
    quantity,
    reason: `Reserva por picking ${relatedEntityId}`,
    relatedEntityType: "picking_batch",
    relatedEntityId,
    actorId
  });
  return updated;
}

/** Libera una reserva previa (al cerrar/cancelar picking). No toca stock fisico. */
export async function releaseReservation(
  materialId: string,
  quantity: number,
  relatedEntityId: string,
  actorId?: string | null
): Promise<Material> {
  if (quantity <= 0) return getRequiredMaterial(materialId);

  if (atomicCommandsAvailable(materialId)) {
    await releaseReservationAtomic(materialId, quantity, `Liberacion de reserva por picking ${relatedEntityId}`, actorId);
    return getRequiredMaterial(materialId);
  }

  const adapter = getAdapter();
  const material = await adapter.get("materials", materialId);
  if (!material) throw new Error(`Material ${materialId} no encontrado`);

  const nextReserved = Math.max(0, (material.reservedStock ?? 0) - quantity);
  const updated = await adapter.update("materials", materialId, {
    reservedStock: nextReserved,
    updatedAt: nowIso(),
    updatedBy: actorId ?? null
  });
  await writeMovement({
    materialId,
    type: "liberacion_reserva",
    quantity,
    reason: `Liberacion de reserva por picking ${relatedEntityId}`,
    relatedEntityType: "picking_batch",
    relatedEntityId,
    actorId
  });
  return updated;
}

async function getRequiredMaterial(materialId: string): Promise<Material> {
  const material = await getAdapter().get("materials", materialId);
  if (!material) throw new Error(`Material ${materialId} no encontrado`);
  return material;
}

/** Deriva el estado del material segun su stock, preservando estados de flujo. */
function deriveMaterialStatus(
  currentStock: number,
  minimumStock: number,
  previous: Material["status"]
): Material["status"] {
  const flowStates: Material["status"][] = ["pendiente_produccion", "preparado", "enviado"];
  if (flowStates.includes(previous)) return previous;
  if (currentStock <= 0) return "agotado";
  return "activo";
}

/** Materiales cuyo stock disponible esta en o por debajo del minimo. */
export function isBelowMinimum(material: Material): boolean {
  return availableStock(material) <= material.minimumStock;
}
