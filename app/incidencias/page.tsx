"use client";

import { useState } from "react";
import { Incident, IncidentSeverity, IncidentStatus, IncidentType } from "@/types";
import { listIncidents, createIncident, updateIncident, removeIncident, changeIncidentStatus, validateIncident, nextIncidentCode } from "@/services/incidents.service";
import { listRequests } from "@/services/requests.service";
import { listShipments } from "@/services/shipments.service";
import { listEntries } from "@/services/entries.service";
import { listPickingBatches } from "@/services/picking.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, EmptyState, ErrorText, Field, Input, Modal, NoAccess, PageHeader, Select, Table, Td, Textarea
} from "@/components/ui";
import { incidentSeverityMeta, incidentStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/dates";

const types: IncidentType[] = ["material_faltante", "material_incorrecto", "medidas_incorrectas", "material_no_encaja", "rotura", "retraso_envio", "error_picking", "error_stock", "incidencia_proveedor", "incidencia_transporte", "otra"];
const severities: IncidentSeverity[] = ["baja", "media", "alta", "critica"];

export default function IncidenciasPage() {
  const { can, user, refreshData } = useSession();
  const { data: incidents } = useData(() => listIncidents(), []);
  const { data: requests } = useData(() => listRequests(), []);
  const { data: shipments } = useData(() => listShipments(), []);
  const { data: entries } = useData(() => listEntries(), []);
  const { data: pickingBatches } = useData(() => listPickingBatches(), []);
  const { catalog } = useCatalog();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Incident>>({});
  const [errors, setErrors] = useState<string[]>([]);

  if (!can("incidents.view")) return <NoAccess />;
  const canCreate = can("incidents.create");
  const canManage = can("incidents.manage");

  async function create() {
    setForm({ severity: "media", status: "abierta", type: "otra", incidentCode: await nextIncidentCode() });
    setErrors([]);
    setOpen(true);
  }
  function edit(i: Incident) {
    setForm(i);
    setErrors([]);
    setOpen(true);
  }

  async function save() {
    const result = validateIncident(form);
    if (!result.valid) return setErrors(result.errors);
    const payload = {
      incidentCode: form.incidentCode!,
      title: form.title!.trim(),
      description: form.description ?? null,
      clientId: form.clientId ?? null,
      campaignId: form.campaignId ?? null,
      serviceId: form.serviceId ?? null,
      pointOfSaleName: form.pointOfSaleName ?? null,
      materialId: form.materialId ?? null,
      materialItemId: form.materialItemId ?? null,
      shipmentId: form.shipmentId ?? null,
      logisticsRequestId: form.logisticsRequestId ?? null,
      stockEntryId: form.stockEntryId ?? null,
      pickingBatchId: form.pickingBatchId ?? null,
      pickingLineId: form.pickingLineId ?? null,
      importBatchId: form.importBatchId ?? null,
      blocksPicking: form.blocksPicking ?? false,
      type: (form.type as IncidentType) ?? "otra",
      severity: (form.severity as IncidentSeverity) ?? "media",
      status: (form.status as IncidentStatus) ?? "abierta",
      assignedTo: form.assignedTo ?? null,
      resolvedAt: form.resolvedAt ?? null,
      resolutionNotes: form.resolutionNotes ?? null
    };
    if (form.id) await updateIncident(form.id, payload, user?.id);
    else await createIncident(payload, user?.id);
    setOpen(false);
    refreshData();
  }

  async function setStatus(i: Incident, status: IncidentStatus) {
    let notes: string | undefined;
    if (status === "resuelta") notes = window.prompt("Notas de resolucion (opcional):") ?? undefined;
    try {
      await changeIncidentStatus(i.id, status, notes, user?.id);
      refreshData();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    }
  }

  async function remove(i: Incident) {
    if (!window.confirm(`Eliminar incidencia ${i.incidentCode}?`)) return;
    await removeIncident(i.id);
    refreshData();
  }

  const campaignsForClient = catalog.campaigns.filter((c) => !form.clientId || c.clientId === form.clientId);
  const servicesForClient = catalog.services.filter((s) => !form.clientId || s.clientId === form.clientId);
  const materialsForClient = catalog.materials.filter((m) => !form.clientId || m.clientId === form.clientId);

  return (
    <div>
      <PageHeader
        title="Incidencias logisticas"
        subtitle="Incidencias vinculables a cliente, campana, servicio, PDV, material, envio, peticion o entrada."
        actions={canCreate ? <Button onClick={create}>+ Nueva incidencia</Button> : undefined}
      />

      {!incidents?.length ? (
        <EmptyState message="No hay incidencias." />
      ) : (
        <Table headers={["Codigo", "Titulo", "Cliente", "Tipo", "Severidad", "Estado", ""]}>
          {incidents.map((i) => (
            <tr key={i.id}>
              <Td className="whitespace-nowrap font-mono text-xs">{i.incidentCode}</Td>
              <Td className="font-medium">
                {i.title}
                <div className="text-xs text-gray-400">{i.pointOfSaleName || catalog.materialName(i.materialId)}</div>
              </Td>
              <Td>{catalog.clientName(i.clientId)}</Td>
              <Td className="text-xs capitalize">{i.type.replace(/_/g, " ")}</Td>
              <Td><Badge tone={incidentSeverityMeta[i.severity].tone}>{incidentSeverityMeta[i.severity].label}</Badge></Td>
              <Td><Badge tone={incidentStatusMeta[i.status].tone}>{incidentStatusMeta[i.status].label}</Badge></Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {canManage ? <Button variant="secondary" onClick={() => edit(i)}>Editar</Button> : null}
                  {canManage ? incidentStatusMeta[i.status].next.map((s) => (
                    <Button key={s} variant="ghost" onClick={() => setStatus(i, s)}>→ {incidentStatusMeta[s].label}</Button>
                  )) : null}
                  {canManage ? <Button variant="danger" onClick={() => remove(i)}>Eliminar</Button> : null}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={form.id ? `Editar ${form.incidentCode}` : "Nueva incidencia"} open={open} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><ErrorText errors={errors} /></div>
          <div className="md:col-span-2">
            <Field label="Titulo"><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          </div>
          <Field label="Tipo">
            <Select value={form.type ?? "otra"} onChange={(e) => setForm({ ...form, type: e.target.value as IncidentType })}>
              {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
          <Field label="Severidad">
            <Select value={form.severity ?? "media"} onChange={(e) => setForm({ ...form, severity: e.target.value as IncidentSeverity })}>
              {severities.map((s) => <option key={s} value={s}>{incidentSeverityMeta[s].label}</option>)}
            </Select>
          </Field>
          <Field label="Cliente / CECO">
            <Select value={form.clientId ?? ""} onChange={(e) => setForm({ ...form, clientId: e.target.value || null, campaignId: null, serviceId: null, materialId: null })}>
              <option value="">(sin cliente)</option>
              {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Campana">
            <Select value={form.campaignId ?? ""} onChange={(e) => setForm({ ...form, campaignId: e.target.value || null })}>
              <option value="">(sin campana)</option>
              {campaignsForClient.map((c) => <option key={c.id} value={c.id}>{c.campaignName}</option>)}
            </Select>
          </Field>
          <Field label="Servicio">
            <Select value={form.serviceId ?? ""} onChange={(e) => setForm({ ...form, serviceId: e.target.value || null })}>
              <option value="">(sin servicio)</option>
              {servicesForClient.map((s) => <option key={s.id} value={s.id}>{s.serviceName}</option>)}
            </Select>
          </Field>
          <Field label="Punto de venta"><Input value={form.pointOfSaleName ?? ""} onChange={(e) => setForm({ ...form, pointOfSaleName: e.target.value })} /></Field>
          <Field label="Material">
            <Select value={form.materialId ?? ""} onChange={(e) => setForm({ ...form, materialId: e.target.value || null })}>
              <option value="">(sin material)</option>
              {materialsForClient.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Peticion">
            <Select value={form.logisticsRequestId ?? ""} onChange={(e) => setForm({ ...form, logisticsRequestId: e.target.value || null })}>
              <option value="">(sin peticion)</option>
              {(requests ?? []).map((r) => <option key={r.id} value={r.id}>{r.requestCode}</option>)}
            </Select>
          </Field>
          <Field label="Envio">
            <Select value={form.shipmentId ?? ""} onChange={(e) => setForm({ ...form, shipmentId: e.target.value || null })}>
              <option value="">(sin envio)</option>
              {(shipments ?? []).map((s) => <option key={s.id} value={s.id}>{s.shipmentCode}</option>)}
            </Select>
          </Field>
          <Field label="Entrada de stock">
            <Select value={form.stockEntryId ?? ""} onChange={(e) => setForm({ ...form, stockEntryId: e.target.value || null })}>
              <option value="">(sin entrada)</option>
              {(entries ?? []).map((en) => <option key={en.id} value={en.id}>{en.id} — {catalog.materialName(en.materialId)}</option>)}
            </Select>
          </Field>
          <Field label="Picking">
            <Select value={form.pickingBatchId ?? ""} onChange={(e) => setForm({ ...form, pickingBatchId: e.target.value || null })}>
              <option value="">(sin picking)</option>
              {(pickingBatches ?? []).map((p) => <option key={p.id} value={p.id}>{p.pickingCode}</option>)}
            </Select>
          </Field>
          <div className="flex items-center">
            <label className="mt-5 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.blocksPicking ?? false} onChange={(e) => setForm({ ...form, blocksPicking: e.target.checked })} />
              Bloquea el cierre del picking
            </label>
          </div>
          <div className="md:col-span-2">
            <Field label="Descripcion"><Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          {form.id ? (
            <div className="md:col-span-2">
              <Field label="Notas de resolucion" hint={form.resolvedAt ? `Resuelta: ${formatDate(form.resolvedAt)}` : undefined}>
                <Textarea rows={2} value={form.resolutionNotes ?? ""} onChange={(e) => setForm({ ...form, resolutionNotes: e.target.value })} />
              </Field>
            </div>
          ) : null}
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
