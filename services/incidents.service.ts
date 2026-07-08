/**
 * Servicio de incidencias logisticas. Una incidencia puede vincularse a
 * cliente, campana, servicio, punto de venta, material, envio, peticion o
 * entrada de stock (todos opcionales).
 */

import { Incident, IncidentStatus } from "@/types";
import { makeCrud, NewEntity } from "@/services/crud";
import { getAdapter } from "@/services/adapter";
import { canTransition, incidentStatusMeta } from "@/lib/status";
import { nextCode } from "@/lib/ids";
import { validate, required } from "@/lib/validation";
import { nowIso } from "@/lib/dates";

const crud = makeCrud("incidents", "inc");

export const listIncidents = () => crud.list();
export const getIncident = (id: string) => crud.get(id);
export const updateIncident = (id: string, patch: Partial<Incident>, actorId?: string | null) =>
  crud.update(id, patch, actorId);
export const removeIncident = (id: string) => crud.remove(id);

export function validateIncident(input: Partial<Incident>) {
  return validate(
    required(input.title, "Titulo"),
    required(input.type, "Tipo"),
    required(input.severity, "Severidad")
  );
}

export async function nextIncidentCode(): Promise<string> {
  const all = await crud.list();
  return nextCode("INC", all.map((i) => i.incidentCode));
}

export const createIncident = (input: NewEntity<Incident>, actorId?: string | null) => crud.create(input, actorId);

/** Cambia el estado validando la transicion; sella resolvedAt al resolver. */
export async function changeIncidentStatus(
  id: string,
  to: IncidentStatus,
  resolutionNotes?: string,
  actorId?: string | null
): Promise<Incident> {
  const current = await getAdapter().get("incidents", id);
  if (!current) throw new Error("Incidencia no encontrada");
  if (!canTransition(incidentStatusMeta, current.status, to)) {
    throw new Error(
      `Transicion no permitida: ${incidentStatusMeta[current.status].label} -> ${incidentStatusMeta[to].label}`
    );
  }
  const patch: Partial<Incident> = { status: to };
  if (to === "resuelta") {
    patch.resolvedAt = nowIso();
    if (resolutionNotes) patch.resolutionNotes = resolutionNotes;
  }
  return crud.update(id, patch, actorId);
}
