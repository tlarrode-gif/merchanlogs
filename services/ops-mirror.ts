/**
 * Espejo de estado logistico hacia MerchanOPS (retorno en tiempo real).
 *
 * Cuando LOGS avanza una peticion/picking/envio, OPS necesita ver el estado
 * actualizado en sus tarjetas de Servicios, vinilos ISDIN y en su tabla de
 * "necesidades" (logistics_material_requirements), que es el pegamento que
 * alimenta esas tarjetas. Este modulo replica el reverse-sync que OPS hace en
 * lib/logistics-store.ts (syncLogisticsBackToSources) para que el estado
 * llegue al instante sin esperar a que alguien use el modulo de OPS.
 *
 * REGLAS (INVARIANTES):
 * - SOLO se escriben las columnas de las listas blancas de abajo. Jamas datos
 *   maestros del servicio/vinilo (nombre, direccion, importes, etc.).
 * - El vocabulario emitido a `logistics_material_requirements.status` respeta
 *   su CHECK constraint real (test dedicado en tests/ops-mirror.test.ts).
 * - Todo es best-effort: un fallo del espejo NO rompe la operacion principal
 *   de LOGS (se registra en consola y la proxima pasada de OPS lo corrige).
 */

import { supabase } from "@/lib/supabase";

// Listas blancas de columnas que el espejo puede tocar. NO ampliar sin
// actualizar docs/SUPABASE_RECONCILIATION.md y los tests.
export const SERVICE_MIRROR_COLUMNS = [
  "logistics_status",
  "material_status",
  "logistics_last_sync_at"
] as const;

export const ISDIN_MIRROR_COLUMNS = [
  "logistics_status",
  "logistics_picking_id",
  "logistics_shipment_id",
  "logistics_blocked",
  "logistics_last_sync_at"
] as const;

export const REQUIREMENT_MIRROR_COLUMNS = [
  "status",
  "picking_id",
  "shipment_id",
  "updated_at"
] as const;

/**
 * Estado de peticion (vocabulario DB de logistics_requests) → estado de
 * necesidad (vocabulario del CHECK de logistics_material_requirements).
 */
export const requirementStatusFromRequest: Record<string, string> = {
  borrador: "pendiente_revision",
  enviada: "pendiente_revision",
  pendiente_revision: "pendiente_revision",
  aceptada: "reservada",
  parcialmente_aceptada: "parcialmente_disponible",
  pendiente_material: "pendiente_stock",
  en_preparacion: "en_picking",
  preparada: "preparada",
  enviada_transporte: "enviada",
  entregada: "entregada",
  cerrada: "consumida",
  rechazada: "cancelada",
  cancelada: "cancelada",
  bloqueada: "bloqueada"
};

/** Etiqueta legible para services.material_status (texto libre en OPS). */
export const materialStatusLabel: Record<string, string> = {
  pendiente_revision: "Solicitud logística enviada",
  reservada: "Material reservado",
  parcialmente_disponible: "Parcialmente disponible",
  pendiente_stock: "Pendiente de stock",
  en_picking: "En preparación",
  preparada: "Material preparado",
  enviada: "Material enviado",
  entregada: "Material entregado",
  consumida: "Material entregado",
  cancelada: "Pendiente",
  bloqueada: "Bloqueado por logística"
};

const BLOCKED_REQUIREMENT_STATUSES = ["bloqueada", "con_incidencia", "pendiente_stock", "pendiente_produccion", "pendiente_recepcion"];

/** Necesidades ya cerradas por OPS que el espejo jamas reabre. */
const FINAL_REQUIREMENT_STATUSES = ["consumida", "cancelada"];

function warn(context: string, error: unknown) {
  // Best-effort: el espejo nunca rompe la operacion principal.
  // eslint-disable-next-line no-console
  console.warn(`[ops-mirror] ${context}:`, error instanceof Error ? error.message : error);
}

/**
 * Ejecuta una escritura del espejo sin dejar que un fallo (de red o de la
 * propia consulta: supabase-js devuelve `{ error }`, no lanza) rompa el flujo.
 */
async function safeMirror(context: string, run: () => PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  try {
    const { error } = await run();
    if (error) warn(context, error.message);
  } catch (error) {
    warn(context, error);
  }
}

/**
 * Propaga un cambio de estado de peticion (valor DB ya mapeado) hacia las
 * necesidades de OPS y las columnas-espejo de services e isdin_vinyls.
 */
export async function mirrorRequestStatus(requestId: string, dbRequestStatus: string): Promise<void> {
  if (!supabase) return;
  const now = new Date().toISOString();
  const reqStatus = requirementStatusFromRequest[dbRequestStatus] ?? "pendiente_revision";
  await safeMirror("requirements.status", () =>
    supabase!
      .from("logistics_material_requirements")
      .update({ status: reqStatus, updated_at: now })
      .eq("request_id", requestId)
      .not("status", "in", `(${FINAL_REQUIREMENT_STATUSES.join(",")})`)
  );
  await safeMirror("services.logistics_status", () =>
    supabase!
      .from("services")
      .update({
        logistics_status: dbRequestStatus,
        material_status: materialStatusLabel[reqStatus] ?? "Solicitud logística enviada",
        logistics_last_sync_at: now
      })
      .eq("logistics_request_id", requestId)
  );
  await safeMirror("isdin_vinyls.logistics_status", () =>
    supabase!
      .from("isdin_vinyls")
      .update({
        logistics_status: reqStatus,
        logistics_blocked: BLOCKED_REQUIREMENT_STATUSES.includes(reqStatus),
        logistics_last_sync_at: now
      })
      .eq("logistics_request_id", requestId)
  );
}

/** Enlaza el picking recien creado con las necesidades y vinilos de su peticion. */
export async function mirrorPickingLink(requestId: string, pickingId: string): Promise<void> {
  if (!supabase) return;
  const now = new Date().toISOString();
  await safeMirror("requirements.picking_id", () =>
    supabase!
      .from("logistics_material_requirements")
      .update({ picking_id: pickingId, updated_at: now })
      .eq("request_id", requestId)
      .not("status", "in", `(${FINAL_REQUIREMENT_STATUSES.join(",")})`)
  );
  await safeMirror("isdin_vinyls.logistics_picking_id", () =>
    supabase!
      .from("isdin_vinyls")
      .update({ logistics_picking_id: pickingId, logistics_last_sync_at: now })
      .eq("logistics_request_id", requestId)
  );
}

/** Enlaza un envio con su peticion, necesidades y vinilos. */
export async function mirrorShipmentLink(requestId: string, shipmentId: string): Promise<void> {
  if (!supabase) return;
  const now = new Date().toISOString();
  await safeMirror("requests.shipment_id", () =>
    supabase!.from("logistics_requests").update({ shipment_id: shipmentId, updated_at: now }).eq("id", requestId)
  );
  await safeMirror("requirements.shipment_id", () =>
    supabase!
      .from("logistics_material_requirements")
      .update({ shipment_id: shipmentId, updated_at: now })
      .eq("request_id", requestId)
      .not("status", "in", `(${FINAL_REQUIREMENT_STATUSES.join(",")})`)
  );
  await safeMirror("isdin_vinyls.logistics_shipment_id", () =>
    supabase!
      .from("isdin_vinyls")
      .update({ logistics_shipment_id: shipmentId, logistics_last_sync_at: now })
      .eq("logistics_request_id", requestId)
  );
}
