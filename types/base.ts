/**
 * Tipos base y campos de preparacion para sincronizacion futura.
 *
 * Todas las entidades logisticas extienden `BaseEntity`. Estos campos NO se usan
 * todavia para sincronizar (MerchanLOGS trabaja con datos locales), pero dejan la
 * estructura lista para que una futura capa Supabase/MerchanOPS pueda mapear cada
 * registro sin rehacer los modelos. Ver docs/SYNC_PREPARATION.md.
 */

/** Sistema de origen del registro. */
export type SourceSystem =
  | "merchanlogs"
  | "merchanops"
  | "merchango"
  | "merchanview"
  | "import"
  | "manual";

/** Estado de sincronizacion de un registro con el sistema externo. */
export type SyncStatus = "local" | "pending" | "synced" | "conflict" | "error";

export type ISODateString = string;

/**
 * Campos comunes a todas las entidades. Incluye los identificadores de
 * integracion requeridos para la futura sincronizacion.
 */
export interface BaseEntity {
  /** Identificador interno de MerchanLOGS (siempre presente). */
  id: string;
  /** Identificador en un sistema externo generico (import, proveedor, etc.). */
  externalId?: string | null;
  /** Identificador del registro equivalente en MerchanOPS. */
  merchanOpsId?: string | null;
  /** Sistema que origino el registro. */
  sourceSystem: SourceSystem;
  /** Estado de sincronizacion. */
  syncStatus: SyncStatus;
  /** Ultima vez que el registro se sincronizo con el sistema externo. */
  lastSyncedAt?: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Usuario (id) que creo el registro. */
  createdBy?: string | null;
  /** Usuario (id) que actualizo el registro por ultima vez. */
  updatedBy?: string | null;
}

/**
 * Valores por defecto de los campos de sincronizacion para un registro creado
 * localmente. Se aplica en la capa de servicios al insertar.
 */
export function defaultSyncFields(
  now: ISODateString,
  createdBy?: string | null
): Omit<BaseEntity, "id"> {
  return {
    externalId: null,
    merchanOpsId: null,
    sourceSystem: "merchanlogs",
    syncStatus: "local",
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: createdBy ?? null,
    updatedBy: createdBy ?? null
  };
}
