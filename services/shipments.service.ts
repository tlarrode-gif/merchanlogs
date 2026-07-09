/**
 * Servicio de envios. El campo trackingNumber/carrier queda preparado para una
 * futura integracion con transportistas (ej. Nacex), no conectada en esta fase.
 */

import { LogisticsRequest, PickingBatch, Shipment } from "@/types";
import { makeCrud, NewEntity } from "@/services/crud";
import { changeRequestStatus } from "@/services/requests.service";
import { getAdapter } from "@/services/adapter";
import { nextCode } from "@/lib/ids";
import { nowIso } from "@/lib/dates";
import { validate, required } from "@/lib/validation";

const crud = makeCrud("shipments", "shp");

export const listShipments = () => crud.list();
export const getShipment = (id: string) => crud.get(id);
export const updateShipment = (id: string, patch: Partial<Shipment>, actorId?: string | null) =>
  crud.update(id, patch, actorId);
export const removeShipment = (id: string) => crud.remove(id);

export function validateShipment(input: Partial<Shipment>) {
  return validate(required(input.status, "Estado"));
}

export async function nextShipmentCode(): Promise<string> {
  const all = await crud.list();
  return nextCode("ENV", all.map((s) => s.shipmentCode));
}

export const createShipment = (input: NewEntity<Shipment>, actorId?: string | null) => crud.create(input, actorId);

/**
 * Crea un envio a partir de una peticion "lista_para_envio" y marca la peticion
 * como "enviada".
 */
export async function createShipmentFromRequest(
  request: LogisticsRequest,
  data: Partial<NewEntity<Shipment>>,
  actorId?: string | null
): Promise<Shipment> {
  const shipmentCode = await nextShipmentCode();
  const shipment = await crud.create(
    {
      shipmentCode,
      logisticsRequestId: request.id,
      clientId: request.clientId,
      campaignId: request.campaignId ?? null,
      carrier: data.carrier ?? null,
      trackingNumber: data.trackingNumber ?? null,
      shippingDate: data.shippingDate ?? null,
      estimatedDeliveryDate: data.estimatedDeliveryDate ?? null,
      deliveryDate: data.deliveryDate ?? null,
      status: data.status ?? "preparado",
      destination: data.destination ?? request.destination ?? null,
      notes: data.notes ?? null
    },
    actorId
  );

  if (request.status === "lista_para_envio") {
    await changeRequestStatus(request.id, "enviada", `Envio ${shipmentCode} generado`, actorId);
  }
  return shipment;
}

/**
 * Crea un envio a partir de un PickingBatch cerrado (listo_para_envio) y marca
 * el batch y sus piezas preparadas como enviados.
 */
export async function createShipmentFromPicking(
  batch: PickingBatch,
  data: Partial<NewEntity<Shipment>>,
  actorId?: string | null
): Promise<Shipment> {
  const shipmentCode = await nextShipmentCode();
  const shipment = await crud.create(
    {
      shipmentCode,
      logisticsRequestId: batch.logisticsRequestId ?? null,
      clientId: batch.clientId,
      campaignId: batch.campaignId ?? null,
      carrier: data.carrier ?? null,
      trackingNumber: data.trackingNumber ?? null,
      shippingDate: data.shippingDate ?? null,
      estimatedDeliveryDate: data.estimatedDeliveryDate ?? null,
      deliveryDate: data.deliveryDate ?? null,
      status: data.status ?? "preparado",
      destination: data.destination ?? batch.assignedInstaller ?? null,
      notes: data.notes ?? `Envio del picking ${batch.pickingCode}`
    },
    actorId
  );

  const adapter = getAdapter();
  await adapter.update("pickingBatches", batch.id, { status: "enviado", updatedAt: nowIso(), updatedBy: actorId ?? null });
  // Marcar piezas preparadas como enviadas y enlazarlas al envio.
  for (const line of batch.lines) {
    if (line.materialItemId && line.status === "preparado") {
      await adapter.update("materialItems", line.materialItemId, {
        status: "enviado",
        shipmentId: shipment.id,
        updatedAt: nowIso(),
        updatedBy: actorId ?? null
      });
    }
  }
  return shipment;
}
