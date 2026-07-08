/**
 * Servicio de picking / preparacion.
 *
 * Opera sobre las lineas de material de una peticion logistica:
 * - marca cantidades como preparadas,
 * - detecta falta de stock,
 * - genera movimientos de tipo preparacion/salida,
 * - deriva el estado de la peticion (pendiente_material / lista_para_envio).
 */

import { LogisticsRequest, Material } from "@/types";
import { getAdapter } from "@/services/adapter";
import { updateRequest, changeRequestStatus } from "@/services/requests.service";
import { applyStockDelta } from "@/services/stock.service";

export interface PickingLineStatus {
  materialId: string;
  materialName: string;
  requested: number;
  prepared: number;
  available: number;
  /** Falta stock disponible para completar lo solicitado. */
  shortage: boolean;
  complete: boolean;
}

/** Devuelve el estado de picking de cada linea de la peticion. */
export async function getPickingStatus(request: LogisticsRequest): Promise<PickingLineStatus[]> {
  const adapter = getAdapter();
  const materials = await adapter.list("materials");
  const byId = new Map<string, Material>(materials.map((m) => [m.id, m]));

  return request.materials.map((line) => {
    const material = byId.get(line.materialId);
    const available = material?.currentStock ?? 0;
    const pending = line.quantity - line.preparedQuantity;
    return {
      materialId: line.materialId,
      materialName: material?.name ?? "(material desconocido)",
      requested: line.quantity,
      prepared: line.preparedQuantity,
      available,
      shortage: pending > available,
      complete: line.preparedQuantity >= line.quantity
    };
  });
}

/**
 * Prepara una cantidad de una linea: descuenta stock (movimiento "preparacion")
 * e incrementa `preparedQuantity`. Lanza error si no hay stock suficiente.
 */
export async function prepareLine(
  requestId: string,
  materialId: string,
  quantity: number,
  actorId?: string | null
): Promise<LogisticsRequest> {
  if (quantity <= 0) throw new Error("La cantidad a preparar debe ser mayor que 0");

  const adapter = getAdapter();
  const request = await adapter.get("logisticsRequests", requestId);
  if (!request) throw new Error("Peticion no encontrada");

  const lineIndex = request.materials.findIndex((l) => l.materialId === materialId);
  if (lineIndex === -1) throw new Error("La peticion no contiene ese material");

  const line = request.materials[lineIndex];
  const remaining = line.quantity - line.preparedQuantity;
  if (quantity > remaining) throw new Error(`Solo quedan ${remaining} unidades por preparar`);

  // Descuenta stock y registra el movimiento de preparacion.
  await applyStockDelta({
    materialId,
    delta: -quantity,
    type: "preparacion",
    reason: `Preparacion peticion ${request.requestCode}`,
    fromLocation: "almacen",
    relatedEntityType: "picking",
    relatedEntityId: requestId,
    actorId
  });

  const materials = request.materials.map((l, i) =>
    i === lineIndex ? { ...l, preparedQuantity: l.preparedQuantity + quantity } : l
  );

  const updated = await updateRequest(requestId, { materials }, actorId);

  // Si la peticion estaba solo solicitada/revision, la pasamos a "preparando".
  if (["solicitada", "en_revision"].includes(updated.status)) {
    return changeRequestStatus(requestId, "preparando", "Inicio de preparacion", actorId);
  }
  return updated;
}

/**
 * Recalcula y ajusta el estado de la peticion tras el picking:
 * - todo preparado -> lista_para_envio
 * - falta stock en alguna linea -> pendiente_material
 */
export async function refreshRequestPickingState(
  requestId: string,
  actorId?: string | null
): Promise<LogisticsRequest> {
  const adapter = getAdapter();
  const request = await adapter.get("logisticsRequests", requestId);
  if (!request) throw new Error("Peticion no encontrada");
  if (request.materials.length === 0) return request;

  const status = await getPickingStatus(request);
  const allComplete = status.every((s) => s.complete);
  const anyShortage = status.some((s) => s.shortage && !s.complete);

  if (allComplete && request.status === "preparando") {
    return changeRequestStatus(requestId, "lista_para_envio", "Todo el material preparado", actorId);
  }
  if (anyShortage && request.status === "preparando") {
    return changeRequestStatus(requestId, "pendiente_material", "Falta stock para completar", actorId);
  }
  return request;
}

/** Peticiones que el almacen debe ver en la cola de picking. */
export const pickingStatuses = [
  "solicitada",
  "en_revision",
  "preparando",
  "pendiente_material",
  "lista_para_envio"
] as const;
