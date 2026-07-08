"use client";

import { useState } from "react";
import Link from "next/link";
import { LogisticsRequestLine, Priority } from "@/types";
import { createOpsRequest } from "@/services/ops-request.service";
import { listRequests } from "@/services/requests.service";
import { createPickingFromRequest } from "@/services/picking.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, Card, EmptyState, ErrorText, Field, Input, NoAccess, PageHeader, Select, Table, Td, Textarea
} from "@/components/ui";
import { priorityMeta, requestStatusMeta } from "@/lib/status";
import { formatDate, isoToDateInput, dateInputToIso } from "@/lib/dates";

const priorities: Priority[] = ["baja", "normal", "alta", "urgente"];

export default function SolicitudesOpsPage() {
  const { can, user, refreshData } = useSession();
  const { data: requests } = useData(() => listRequests(), []);
  const { catalog } = useCatalog();
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState<{
    clientId: string; campaignId: string; serviceId: string; priority: Priority;
    neededByDate: string | null; destination: string; notes: string; merchanOpsId: string;
  }>({ clientId: "", campaignId: "", serviceId: "", priority: "alta", neededByDate: null, destination: "", notes: "", merchanOpsId: "" });
  const [lines, setLines] = useState<LogisticsRequestLine[]>([]);

  if (!can("ops.simulate")) return <NoAccess />;

  const opsRequests = (requests ?? []).filter((r) => r.sourceSystem === "merchanops");
  const materialsForClient = catalog.materials.filter((m) => !form.clientId || m.clientId === form.clientId);
  const campaignsForClient = catalog.campaigns.filter((c) => !form.clientId || c.clientId === form.clientId);
  const servicesForClient = catalog.services.filter((s) => !form.clientId || s.clientId === form.clientId);

  function addLine() {
    setLines([...lines, { materialId: materialsForClient[0]?.id ?? "", quantity: 1, preparedQuantity: 0, notes: null }]);
  }

  async function submit() {
    if (!form.clientId) return setErrors(["Selecciona cliente"]);
    if (!form.merchanOpsId) return setErrors(["Indica un merchanOpsId (id de la peticion en OPS)"]);
    await createOpsRequest(
      {
        clientId: form.clientId,
        campaignId: form.campaignId || null,
        serviceId: form.serviceId || null,
        merchanOpsId: form.merchanOpsId,
        externalId: form.merchanOpsId,
        priority: form.priority,
        neededByDate: form.neededByDate,
        destination: form.destination || null,
        notes: form.notes || null,
        materials: lines.filter((l) => l.materialId).map((l) => ({ ...l, quantity: Number(l.quantity) }))
      },
      user?.id
    );
    setForm({ clientId: "", campaignId: "", serviceId: "", priority: "alta", neededByDate: null, destination: "", notes: "", merchanOpsId: "" });
    setLines([]);
    setErrors([]);
    refreshData();
    window.alert("Solicitud OPS simulada creada (sourceSystem=merchanops, syncStatus=pending).");
  }

  async function toPicking(requestId: string) {
    const req = (requests ?? []).find((r) => r.id === requestId);
    if (!req) return;
    try {
      await createPickingFromRequest(req, "manual", user?.id);
      refreshData();
      window.alert("Picking creado desde la solicitud OPS.");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Solicitudes desde OPS (simulacion)"
        subtitle="Simula localmente una peticion entrante de MerchanOPS. NO conecta con OPS real; deja preparados los campos de sincronizacion."
      />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nueva solicitud simulada</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><ErrorText errors={errors} /></div>
          <Field label="merchanOpsId (id externo)"><Input value={form.merchanOpsId} onChange={(e) => setForm({ ...form, merchanOpsId: e.target.value })} placeholder="ops_req_00123" /></Field>
          <Field label="Prioridad">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
              {priorities.map((p) => <option key={p} value={p}>{priorityMeta[p].label}</option>)}
            </Select>
          </Field>
          <Field label="Cliente / CECO">
            <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value, campaignId: "", serviceId: "" })}>
              <option value="">Selecciona cliente</option>
              {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Campana">
            <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
              <option value="">(sin campana)</option>
              {campaignsForClient.map((c) => <option key={c.id} value={c.id}>{c.campaignName}</option>)}
            </Select>
          </Field>
          <Field label="Servicio">
            <Select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
              <option value="">(sin servicio)</option>
              {servicesForClient.map((s) => <option key={s.id} value={s.id}>{s.serviceName}</option>)}
            </Select>
          </Field>
          <Field label="Necesaria para">
            <Input type="date" value={isoToDateInput(form.neededByDate)} onChange={(e) => setForm({ ...form, neededByDate: dateInputToIso(e.target.value) })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Destino"><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></Field>
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Materiales</span>
              <Button variant="secondary" onClick={addLine}>+ Material</Button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="mb-2 grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <Select value={l.materialId} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, materialId: e.target.value } : x))} className="w-full">
                    <option value="">Material</option>
                    {materialsForClient.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                </div>
                <div className="col-span-1">
                  <Button variant="danger" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>✕</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="md:col-span-2">
            <Field label="Notas"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={submit}>Crear solicitud simulada</Button>
          </div>
        </div>
      </Card>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Solicitudes con origen MerchanOPS</h2>
      {opsRequests.length === 0 ? (
        <EmptyState message="No hay solicitudes simuladas desde OPS." />
      ) : (
        <Table headers={["Codigo", "merchanOpsId", "Cliente", "Prioridad", "Estado", "Sync", "Necesaria", ""]}>
          {opsRequests.map((r) => (
            <tr key={r.id}>
              <Td className="font-mono text-xs">{r.requestCode}</Td>
              <Td className="font-mono text-xs">{r.merchanOpsId || "-"}</Td>
              <Td>{catalog.clientName(r.clientId)}</Td>
              <Td><Badge tone={priorityMeta[r.priority].tone}>{priorityMeta[r.priority].label}</Badge></Td>
              <Td><Badge tone={requestStatusMeta[r.status].tone}>{requestStatusMeta[r.status].label}</Badge></Td>
              <Td><Badge tone="amber">{r.syncStatus}</Badge></Td>
              <Td className="whitespace-nowrap text-xs">{formatDate(r.neededByDate)}</Td>
              <Td className="flex gap-2">
                <Button variant="secondary" onClick={() => toPicking(r.id)}>Convertir en picking</Button>
                <Link href="/peticiones"><Button variant="ghost">Ver</Button></Link>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
