/**
 * Servicio de stock y movimientos.
 *
 * Regla central del dominio: cualquier cambio de `currentStock` de un material
 * debe pasar por `applyStockDelta`, que ademas registra el movimiento
 * correspondiente. Asi el historico de movimientos siempre cuadra con el stock.
 */

import { Material, StockMovement, StockMovementType, RelatedEntityType } from "@/types";
import { getAdapter } from "@/services/adapter";
import { makeCrud } from "@/services/crud";
import { materialStatusMeta } from "@/lib/status";
import { nowIso } from "@/lib/dates";

const movementsCrud = makeCrud("stockMovements", "mov");

export const listMovements = () => movementsCrud.list();

export interface StockChange {
  materialId: string;
  /** Delta a aplicar al stock (positivo suma, negativo resta). */
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
 * Aplica un cambio de stock a un material y registra el movimiento asociado.
 * Devuelve el material actualizado. No permite dejar stock negativo.
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

  const movement = await movementsCrud.create(
    {
      materialId: material.id,
      clientId: material.clientId,
      campaignId: material.campaignId ?? null,
      type: change.type,
      quantity: Math.abs(change.delta),
      fromLocation: change.fromLocation ?? null,
      toLocation: change.toLocation ?? null,
      reason: change.reason ?? null,
      relatedEntityType: change.relatedEntityType ?? null,
      relatedEntityId: change.relatedEntityId ?? null
    },
    change.actorId
  );

  return { material: updatedMaterial, movement };
}

/** Registra un movimiento SIN alterar el stock (ej. reserva/preparacion logica). */
export async function recordMovement(change: Omit<StockChange, "delta"> & { quantity: number }): Promise<StockMovement> {
  const adapter = getAdapter();
  const material = await adapter.get("materials", change.materialId);
  return movementsCrud.create(
    {
      materialId: change.materialId,
      clientId: material?.clientId ?? null,
      campaignId: material?.campaignId ?? null,
      type: change.type,
      quantity: change.quantity,
      fromLocation: change.fromLocation ?? null,
      toLocation: change.toLocation ?? null,
      reason: change.reason ?? null,
      relatedEntityType: change.relatedEntityType ?? null,
      relatedEntityId: change.relatedEntityId ?? null
    },
    change.actorId
  );
}

/** Deriva el estado del material segun su stock, preservando estados de flujo. */
function deriveMaterialStatus(
  currentStock: number,
  minimumStock: number,
  previous: Material["status"]
): Material["status"] {
  // Estados de flujo de produccion/preparacion no se sobreescriben por stock.
  const flowStates: Material["status"][] = ["pendiente_produccion", "preparado", "enviado"];
  if (flowStates.includes(previous)) return previous;
  if (currentStock <= 0) return "agotado";
  if (currentStock <= minimumStock) return materialStatusMeta.recibido ? "recibido" : previous;
  return "activo";
}

/** Materiales cuyo stock esta en o por debajo del minimo. */
export function isBelowMinimum(material: Material): boolean {
  return material.currentStock <= material.minimumStock;
}
