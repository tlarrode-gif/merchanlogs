/**
 * Contrato de la capa de acceso a datos (patron Adapter/Repository).
 *
 * La UI y los servicios de dominio SOLO hablan con este contrato, nunca con el
 * origen de datos concreto. Hoy el adaptador activo es el local (memoria +
 * localStorage). Cuando se active la integracion, bastara con implementar un
 * `SupabaseAdapter` con esta misma interfaz y cambiar `getAdapter()` sin tocar
 * los servicios ni las pantallas. Ver docs/SYNC_PREPARATION.md.
 */

import { CollectionName, CollectionTypeMap } from "@/types";
import { localAdapter } from "@/services/local-adapter";

export interface DataAdapter {
  list<K extends CollectionName>(collection: K): Promise<CollectionTypeMap[K][]>;
  get<K extends CollectionName>(collection: K, id: string): Promise<CollectionTypeMap[K] | null>;
  insert<K extends CollectionName>(collection: K, entity: CollectionTypeMap[K]): Promise<CollectionTypeMap[K]>;
  update<K extends CollectionName>(
    collection: K,
    id: string,
    patch: Partial<CollectionTypeMap[K]>
  ): Promise<CollectionTypeMap[K]>;
  remove<K extends CollectionName>(collection: K, id: string): Promise<void>;
  /** Restablece el almacen a los datos semilla (util para pruebas/demos). */
  reset(): Promise<void>;
}

/** Origen de datos activo. Controlado por NEXT_PUBLIC_DATA_SOURCE (default: local). */
export function getAdapter(): DataAdapter {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase") {
    // Import perezoso para no cargar el adaptador Supabase al trabajar en local.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabaseAdapter } = require("@/services/supabase-adapter") as typeof import("@/services/supabase-adapter");
    return supabaseAdapter;
  }
  return localAdapter;
}
