/**
 * Servicio de entradas de material.
 *
 * Regla de dominio: al pasar una entrada a estado "recibida" o
 * "parcialmente_recibida" se incrementa el stock del material (una sola vez) y
 * se genera el movimiento de tipo "entrada". Para evitar duplicar stock si se
 * reedita una entrada ya aplicada, se marca con un flag interno via el campo
 * `deliveryNote` no — mejor: se controla comparando el estado previo.
 */

import { StockEntry, StockEntryStatus } from "@/types";
import { makeCrud, NewEntity } from "@/services/crud";
import { getAdapter } from "@/services/adapter";
import { applyStockDelta } from "@/services/stock.service";
import { stockAddingEntryStatuses } from "@/lib/status";
import { validate, required, positive } from "@/lib/validation";
import { nowIso } from "@/lib/dates";

const crud = makeCrud("stockEntries", "ent");

export const listEntries = () => crud.list();
export const getEntry = (id: string) => crud.get(id);

export function validateEntry(input: Partial<StockEntry>) {
  return validate(
    required(input.clientId, "Cliente/CECO"),
    required(input.materialId, "Material"),
    required(input.entryDate, "Fecha de entrada"),
    input.quantity != null ? positive(input.quantity, "Cantidad") : "Cantidad es obligatorio"
  );
}

/**
 * Crea una entrada. Si nace ya en estado que suma stock, aplica el incremento.
 */
export async function createEntry(input: NewEntity<StockEntry>, actorId?: string | null): Promise<StockEntry> {
  const entry = await crud.create(input, actorId);
  if (stockAddingEntryStatuses.includes(entry.status)) {
    await applyReceivedStock(entry, actorId);
  }
  return entry;
}

/**
 * Cambia el estado de una entrada. Si transita hacia "recibida"/"parcial" desde
 * un estado que NO sumaba stock, aplica el incremento.
 */
export async function changeEntryStatus(
  id: string,
  status: StockEntryStatus,
  actorId?: string | null
): Promise<StockEntry> {
  const current = await getAdapter().get("stockEntries", id);
  if (!current) throw new Error("Entrada no encontrada");

  const wasAdding = stockAddingEntryStatuses.includes(current.status);
  const willAdd = stockAddingEntryStatuses.includes(status);

  const updated = await crud.update(id, { status }, actorId);

  if (!wasAdding && willAdd) {
    await applyReceivedStock(updated, actorId);
  }
  return updated;
}

/** Actualiza campos generales de la entrada (sin re-aplicar stock). */
export const updateEntry = (id: string, patch: Partial<StockEntry>, actorId?: string | null) =>
  crud.update(id, patch, actorId);

export const removeEntry = (id: string) => crud.remove(id);

async function applyReceivedStock(entry: StockEntry, actorId?: string | null): Promise<void> {
  await applyStockDelta({
    materialId: entry.materialId,
    delta: entry.quantity,
    type: "entrada",
    reason: `Entrada ${entry.id}${entry.deliveryNote ? ` (albaran ${entry.deliveryNote})` : ""}`,
    toLocation: "almacen",
    relatedEntityType: "entrada",
    relatedEntityId: entry.id,
    actorId
  });
  // Sella el momento en que se aplico el stock.
  await crud.update(entry.id, { updatedAt: nowIso() }, actorId);
}
