/** Utilidades compartidas por los tests de la capa de servicios. */

import { Material } from "@/types";
import { getAdapter } from "@/services/adapter";
import { defaultSyncFields } from "@/types";
import { uid } from "@/lib/ids";
import { nowIso } from "@/lib/dates";

/** Inserta un material controlado en el almacen local y devuelve su id. */
export async function seedMaterial(overrides: Partial<Material> = {}): Promise<Material> {
  const now = nowIso();
  const material: Material = {
    id: uid("mat"),
    clientId: "cli_test",
    campaignId: null,
    name: "Material de prueba",
    materialCode: "MAT-TEST",
    type: "otro",
    unit: "ud",
    currentStock: 10,
    reservedStock: 0,
    minimumStock: 2,
    status: "activo",
    ...defaultSyncFields(now, "usr_test"),
    ...overrides
  } as Material;
  return getAdapter().insert("materials", material);
}

/** Relee un material desde el almacen (para comprobar mutaciones). */
export async function readMaterial(id: string): Promise<Material> {
  const m = await getAdapter().get("materials", id);
  if (!m) throw new Error(`Material ${id} no encontrado en el test`);
  return m;
}
