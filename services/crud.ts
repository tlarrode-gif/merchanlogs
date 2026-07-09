/**
 * Factory CRUD generico sobre el adaptador de datos.
 *
 * Rellena automaticamente id, campos de sincronizacion y timestamps al crear, y
 * actualiza `updatedAt`/`updatedBy` al modificar. Los servicios de dominio se
 * construyen encima de esto y anaden su logica especifica.
 */

import { BaseEntity, CollectionName, CollectionTypeMap, defaultSyncFields } from "@/types";
import { getAdapter } from "@/services/adapter";
import { uid } from "@/lib/ids";
import { nowIso } from "@/lib/dates";
import { sanitizeDeep } from "@/lib/sanitize";

/** Campos que el llamante NO debe aportar (los gestiona la capa CRUD). */
export type NewEntity<T extends BaseEntity> = Omit<
  T,
  keyof BaseEntity
> & Partial<Pick<T, "externalId" | "merchanOpsId" | "sourceSystem" | "syncStatus">>;

export function makeCrud<K extends CollectionName>(collection: K, idPrefix: string) {
  type T = CollectionTypeMap[K];

  return {
    collection,

    list(): Promise<T[]> {
      return getAdapter().list(collection);
    },

    get(id: string): Promise<T | null> {
      return getAdapter().get(collection, id);
    },

    async create(input: NewEntity<T>, actorId?: string | null): Promise<T> {
      const now = nowIso();
      const sync = defaultSyncFields(now, actorId);
      const entity = {
        // Todo lo que entra por la capa CRUD se sanitiza (strings en profundidad).
        ...(sanitizeDeep(input) as object),
        ...sync,
        // Permitir sobreescribir procedencia si el registro viene de fuera.
        externalId: (input as Partial<BaseEntity>).externalId ?? sync.externalId,
        merchanOpsId: (input as Partial<BaseEntity>).merchanOpsId ?? sync.merchanOpsId,
        sourceSystem: (input as Partial<BaseEntity>).sourceSystem ?? sync.sourceSystem,
        syncStatus: (input as Partial<BaseEntity>).syncStatus ?? sync.syncStatus,
        id: uid(idPrefix)
      } as T;
      return getAdapter().insert(collection, entity);
    },

    async update(id: string, patch: Partial<T>, actorId?: string | null): Promise<T> {
      const finalPatch = {
        ...(sanitizeDeep(patch) as object),
        updatedAt: nowIso(),
        updatedBy: actorId ?? null
      } as Partial<T>;
      return getAdapter().update(collection, id, finalPatch);
    },

    remove(id: string): Promise<void> {
      return getAdapter().remove(collection, id);
    }
  };
}
