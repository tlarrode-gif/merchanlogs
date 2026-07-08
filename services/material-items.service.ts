/**
 * Servicio de piezas unitarias (MaterialItem). Cada `itemCode` es unico:
 * detectar duplicados es una regla central (ej. vinilos VIN de ISDIN).
 */

import { MaterialItem } from "@/types";
import { makeCrud } from "@/services/crud";
import { getAdapter } from "@/services/adapter";

const crud = makeCrud("materialItems", "itm");

export const listMaterialItems = () => crud.list();
export const getMaterialItem = (id: string) => crud.get(id);
export const updateMaterialItem = (id: string, patch: Partial<MaterialItem>, actorId?: string | null) =>
  crud.update(id, patch, actorId);
export const removeMaterialItem = (id: string) => crud.remove(id);

/** Normaliza un codigo de pieza para comparar (mayusculas, sin espacios). */
export function normalizeItemCode(code: string): string {
  return (code || "").trim().toUpperCase();
}

/** Devuelve el item existente con ese codigo, o null. */
export async function findByCode(itemCode: string): Promise<MaterialItem | null> {
  const target = normalizeItemCode(itemCode);
  const items = await crud.list();
  return items.find((it) => normalizeItemCode(it.itemCode) === target) ?? null;
}

/** True si ya existe una pieza con ese codigo. */
export async function isDuplicateCode(itemCode: string): Promise<boolean> {
  return (await findByCode(itemCode)) !== null;
}

export const createMaterialItem = (input: Parameters<typeof crud.create>[0], actorId?: string | null) =>
  crud.create(input, actorId);

/** Conjunto de codigos existentes (para validaciones masivas eficientes). */
export async function existingCodeSet(): Promise<Set<string>> {
  const items = await getAdapter().list("materialItems");
  return new Set(items.map((it) => normalizeItemCode(it.itemCode)));
}
