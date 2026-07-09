/**
 * Helpers para construir datos semilla con los campos de BaseEntity ya
 * rellenos. Se usan fechas fijas para que la semilla sea determinista.
 */

import { BaseEntity, SourceSystem } from "@/types";

/** Fecha base de la semilla (determinista). */
export const SEED_NOW = "2026-07-01T08:00:00.000Z";

/** Devuelve los campos de sincronizacion para un registro semilla. */
export function seedBase(
  overrides: Partial<Pick<BaseEntity, "externalId" | "merchanOpsId" | "sourceSystem" | "createdBy" | "syncStatus" | "createdAt" | "updatedAt">> = {}
): Omit<BaseEntity, "id"> {
  const source: SourceSystem = overrides.sourceSystem ?? "merchanlogs";
  return {
    externalId: overrides.externalId ?? null,
    merchanOpsId: overrides.merchanOpsId ?? null,
    sourceSystem: source,
    syncStatus: overrides.syncStatus ?? "local",
    lastSyncedAt: null,
    createdAt: overrides.createdAt ?? SEED_NOW,
    updatedAt: overrides.updatedAt ?? SEED_NOW,
    createdBy: overrides.createdBy ?? "admin",
    updatedBy: overrides.createdBy ?? "admin"
  };
}
