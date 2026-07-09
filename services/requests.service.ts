/**
 * Servicio de peticiones logisticas.
 *
 * Gestiona el CRUD, el cambio de estado validado por la maquina de estados de
 * lib/status.ts y el registro de un historico basico de cambios.
 */

import { LogisticsRequest, LogisticsRequestStatus, RequestHistoryEntry } from "@/types";
import { makeCrud, NewEntity } from "@/services/crud";
import { getAdapter } from "@/services/adapter";
import { canTransition, requestStatusMeta } from "@/lib/status";
import { validate, required } from "@/lib/validation";
import { nextCode } from "@/lib/ids";

const crud = makeCrud("logisticsRequests", "req");
const historyCrud = makeCrud("requestHistory", "rqh");

export const listRequests = () => crud.list();
export const getRequest = (id: string) => crud.get(id);

export async function listHistory(requestId: string): Promise<RequestHistoryEntry[]> {
  const all = await historyCrud.list();
  return all
    .filter((h) => h.requestId === requestId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function validateRequest(input: Partial<LogisticsRequest>) {
  return validate(
    required(input.clientId, "Cliente/CECO"),
    required(input.priority, "Prioridad"),
    required(input.status, "Estado")
  );
}

/** Genera el proximo codigo de peticion (PET-AAAA-####). */
export async function nextRequestCode(): Promise<string> {
  const all = await crud.list();
  return nextCode("PET", all.map((r) => r.requestCode));
}

export async function createRequest(input: NewEntity<LogisticsRequest>, actorId?: string | null): Promise<LogisticsRequest> {
  const request = await crud.create(input, actorId);
  await historyCrud.create(
    { requestId: request.id, fromStatus: null, toStatus: request.status, note: "Peticion creada" },
    actorId
  );
  return request;
}

export const updateRequest = (id: string, patch: Partial<LogisticsRequest>, actorId?: string | null) =>
  crud.update(id, patch, actorId);

export const removeRequest = (id: string) => crud.remove(id);

/**
 * Cambia el estado validando la transicion. Registra la entrada en el historico.
 */
export async function changeRequestStatus(
  id: string,
  to: LogisticsRequestStatus,
  note?: string,
  actorId?: string | null
): Promise<LogisticsRequest> {
  const current = await getAdapter().get("logisticsRequests", id);
  if (!current) throw new Error("Peticion no encontrada");

  if (!canTransition(requestStatusMeta, current.status, to)) {
    throw new Error(
      `Transicion no permitida: ${requestStatusMeta[current.status].label} -> ${requestStatusMeta[to].label}`
    );
  }

  const updated = await crud.update(id, { status: to }, actorId);
  await historyCrud.create(
    { requestId: id, fromStatus: current.status, toStatus: to, note: note ?? null },
    actorId
  );
  return updated;
}
