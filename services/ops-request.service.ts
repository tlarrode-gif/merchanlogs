/**
 * Simulacion LOCAL de una solicitud de picking/envio proveniente de MerchanOPS.
 *
 * NO conecta con MerchanOPS real. Crea una LogisticsRequest marcada con
 * `sourceSystem = "merchanops"` y los campos de sincronizacion en estado
 * `pending`, tal como llegaria una peticion externa. Desde ella, almacen puede
 * generar el PickingBatch. Ver docs/OPS_REQUEST_FLOW.md.
 */

import { LogisticsRequest, LogisticsRequestLine, Priority } from "@/types";
import { createRequest, nextRequestCode } from "@/services/requests.service";
import { nowIso } from "@/lib/dates";

export interface OpsRequestInput {
  clientId: string;
  campaignId?: string | null;
  serviceId?: string | null;
  merchanOpsId: string;
  externalId?: string | null;
  requestedBy?: string | null;
  priority?: Priority;
  neededByDate?: string | null;
  destination?: string | null;
  notes?: string | null;
  materials: LogisticsRequestLine[];
}

/** Crea una peticion logistica simulando su origen en MerchanOPS. */
export async function createOpsRequest(input: OpsRequestInput, actorId?: string | null): Promise<LogisticsRequest> {
  const requestCode = await nextRequestCode();
  return createRequest(
    {
      requestCode,
      clientId: input.clientId,
      campaignId: input.campaignId ?? null,
      serviceId: input.serviceId ?? null,
      requestedBy: input.requestedBy ?? "MerchanOPS",
      assignedTo: null,
      priority: input.priority ?? "normal",
      status: "solicitada",
      requestedDate: nowIso(),
      neededByDate: input.neededByDate ?? null,
      materials: input.materials,
      destination: input.destination ?? null,
      notes: input.notes ?? null,
      // Campos de preparacion para la futura sincronizacion real.
      sourceSystem: "merchanops",
      merchanOpsId: input.merchanOpsId,
      externalId: input.externalId ?? null,
      syncStatus: "pending"
    },
    actorId
  );
}
