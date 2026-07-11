"use client";

import { useState } from "react";
import { Shipment, ShipmentStatus } from "@/types";
import { listShipments, updateShipment, removeShipment, createShipmentFromRequest, createShipment, nextShipmentCode, confirmDelivery } from "@/services/shipments.service";
import { listRequests } from "@/services/requests.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, EmptyState, Field, Input, Modal, NoAccess, PageHeader, Select, Table, Td, Textarea
} from "@/components/ui";
import { shipmentStatusMeta } from "@/lib/status";
import { formatDate, isoToDateInput, dateInputToIso } from "@/lib/dates";

export default function EnviosPage() {
  const { can, user, refreshData } = useSession();
  const { data: shipments } = useData(() => listShipments(), []);
  const { data: requests } = useData(() => listRequests(), []);
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Shipment>>({});

  if (!can("shipments.view")) return <NoAccess />;
  const canManage = can("shipments.manage");

  const readyRequests = (requests ?? []).filter((r) => r.status === "lista_para_envio");

  async function create() {
    setForm({ status: "preparado", shipmentCode: await nextShipmentCode() });
    setOpen(true);
  }

  async function save() {
    const linkedRequest = (requests ?? []).find((r) => r.id === form.logisticsRequestId);
    if (linkedRequest) {
      await createShipmentFromRequest(linkedRequest, form, user?.id);
    } else {
      await createShipment(
        {
          shipmentCode: form.shipmentCode!,
          logisticsRequestId: null,
          clientId: form.clientId ?? null,
          campaignId: form.campaignId ?? null,
          carrier: form.carrier ?? null,
          trackingNumber: form.trackingNumber ?? null,
          shippingDate: form.shippingDate ?? null,
          estimatedDeliveryDate: form.estimatedDeliveryDate ?? null,
          deliveryDate: form.deliveryDate ?? null,
          status: (form.status as ShipmentStatus) ?? "pendiente",
          destination: form.destination ?? null,
          notes: form.notes ?? null
        },
        user?.id
      );
    }
    setOpen(false);
    refreshData();
  }

  async function setStatus(s: Shipment, status: ShipmentStatus) {
    try {
      if (status === "entregado") {
        // A8: entrega exactamente-una-vez via comando atomico.
        await confirmDelivery(s, user?.id);
      } else {
        await updateShipment(s.id, { status }, user?.id);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo cambiar el estado del envio");
    }
    refreshData();
  }

  async function remove(s: Shipment) {
    if (!window.confirm(`Eliminar envio ${s.shipmentCode}?`)) return;
    await removeShipment(s.id);
    refreshData();
  }

  function onSelectRequest(requestId: string) {
    const r = (requests ?? []).find((x) => x.id === requestId);
    setForm({ ...form, logisticsRequestId: requestId || null, clientId: r?.clientId, campaignId: r?.campaignId ?? null, destination: r?.destination ?? form.destination });
  }

  return (
    <div>
      <PageHeader
        title="Envios"
        subtitle="Registro de envios. Campos de transportista/tracking preparados para futura integracion (ej. Nacex)."
        actions={canManage ? <Button onClick={create}>+ Nuevo envio</Button> : undefined}
      />

      {!shipments?.length ? (
        <EmptyState message="No hay envios." />
      ) : (
        <Table headers={["Codigo", "Cliente", "Peticion", "Transportista", "Tracking", "Fechas", "Estado", ""]}>
          {shipments.map((s) => (
            <tr key={s.id}>
              <Td className="whitespace-nowrap font-mono text-xs">{s.shipmentCode}</Td>
              <Td>{catalog.clientName(s.clientId)}</Td>
              <Td className="text-xs text-gray-500">{(requests ?? []).find((r) => r.id === s.logisticsRequestId)?.requestCode || "-"}</Td>
              <Td>{s.carrier || "-"}</Td>
              <Td className="font-mono text-xs">{s.trackingNumber || "-"}</Td>
              <Td className="whitespace-nowrap text-xs text-gray-500">
                Env: {formatDate(s.shippingDate)}<br />Ent: {formatDate(s.deliveryDate)}
              </Td>
              <Td><Badge tone={shipmentStatusMeta[s.status].tone}>{shipmentStatusMeta[s.status].label}</Badge></Td>
              <Td>
                {canManage ? (
                  <div className="flex flex-wrap gap-1">
                    {shipmentStatusMeta[s.status].next.map((st) => (
                      <Button key={st} variant="ghost" onClick={() => setStatus(s, st)}>→ {shipmentStatusMeta[st].label}</Button>
                    ))}
                    <Button variant="danger" onClick={() => remove(s)}>Eliminar</Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title="Nuevo envio" open={open} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Codigo"><Input value={form.shipmentCode ?? ""} readOnly /></Field>
          <Field label="Desde peticion (lista para envio)">
            <Select value={form.logisticsRequestId ?? ""} onChange={(e) => onSelectRequest(e.target.value)}>
              <option value="">(envio manual)</option>
              {readyRequests.map((r) => <option key={r.id} value={r.id}>{r.requestCode} — {catalog.clientName(r.clientId)}</option>)}
            </Select>
          </Field>
          <Field label="Cliente">
            <Select value={form.clientId ?? ""} onChange={(e) => setForm({ ...form, clientId: e.target.value || null })}>
              <option value="">(sin cliente)</option>
              {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Transportista"><Input value={form.carrier ?? ""} onChange={(e) => setForm({ ...form, carrier: e.target.value })} /></Field>
          <Field label="Tracking" hint="Preparado para integracion futura con transportista."><Input value={form.trackingNumber ?? ""} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} /></Field>
          <Field label="Estado">
            <Select value={form.status ?? "preparado"} onChange={(e) => setForm({ ...form, status: e.target.value as ShipmentStatus })}>
              {(Object.keys(shipmentStatusMeta) as ShipmentStatus[]).map((s) => <option key={s} value={s}>{shipmentStatusMeta[s].label}</option>)}
            </Select>
          </Field>
          <Field label="Fecha envio">
            <Input type="date" value={isoToDateInput(form.shippingDate)} onChange={(e) => setForm({ ...form, shippingDate: dateInputToIso(e.target.value) })} />
          </Field>
          <Field label="Entrega estimada">
            <Input type="date" value={isoToDateInput(form.estimatedDeliveryDate)} onChange={(e) => setForm({ ...form, estimatedDeliveryDate: dateInputToIso(e.target.value) })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Destino"><Input value={form.destination ?? ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Notas"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
