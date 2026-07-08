"use client";

import { useState } from "react";
import { LogisticsRequest, LogisticsRequestLine, LogisticsRequestStatus, Priority, RequestHistoryEntry } from "@/types";
import {
  listRequests, createRequest, updateRequest, removeRequest, changeRequestStatus,
  validateRequest, nextRequestCode, listHistory
} from "@/services/requests.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, EmptyState, ErrorText, Field, Input, Modal, NoAccess, PageHeader, Select, Table, Td, Textarea
} from "@/components/ui";
import { priorityMeta, requestStatusMeta } from "@/lib/status";
import { formatDate, formatDateTime, isoToDateInput, dateInputToIso, nowIso } from "@/lib/dates";

const priorities: Priority[] = ["baja", "normal", "alta", "urgente"];

export default function PeticionesPage() {
  const { can, user, refreshData } = useSession();
  const { data: requests } = useData(() => listRequests(), []);
  const { catalog } = useCatalog();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<LogisticsRequest>>({});
  const [lines, setLines] = useState<LogisticsRequestLine[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [historyFor, setHistoryFor] = useState<LogisticsRequest | null>(null);
  const [history, setHistory] = useState<RequestHistoryEntry[]>([]);

  if (!can("requests.view")) return <NoAccess />;
  const canCreate = can("requests.create");
  const canManage = can("requests.manage");
  const canChangeStatus = can("requests.changeStatus") || canManage;
  const canDelete = can("requests.delete");

  async function create() {
    setForm({ priority: "normal", status: "borrador", requestedDate: nowIso(), requestCode: await nextRequestCode(), requestedBy: user?.id });
    setLines([]);
    setErrors([]);
    setOpen(true);
  }
  function edit(r: LogisticsRequest) {
    setForm(r);
    setLines(r.materials);
    setErrors([]);
    setOpen(true);
  }

  const materialsForClient = catalog.materials.filter((m) => !form.clientId || m.clientId === form.clientId);
  const campaignsForClient = catalog.campaigns.filter((c) => !form.clientId || c.clientId === form.clientId);
  const servicesForClient = catalog.services.filter((s) => !form.clientId || s.clientId === form.clientId);

  function addLine() {
    setLines([...lines, { materialId: materialsForClient[0]?.id ?? "", quantity: 1, preparedQuantity: 0, notes: null }]);
  }
  function updateLine(i: number, patch: Partial<LogisticsRequestLine>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines(lines.filter((_, idx) => idx !== i));
  }

  async function save() {
    const result = validateRequest(form);
    if (!result.valid) return setErrors(result.errors);
    const cleanLines = lines.filter((l) => l.materialId).map((l) => ({ ...l, quantity: Number(l.quantity), preparedQuantity: Number(l.preparedQuantity) }));
    const payload = {
      requestCode: form.requestCode!,
      clientId: form.clientId!,
      campaignId: form.campaignId ?? null,
      serviceId: form.serviceId ?? null,
      requestedBy: form.requestedBy ?? user?.id ?? null,
      assignedTo: form.assignedTo ?? null,
      priority: (form.priority as Priority) ?? "normal",
      status: (form.status as LogisticsRequestStatus) ?? "borrador",
      requestedDate: form.requestedDate ?? nowIso(),
      neededByDate: form.neededByDate ?? null,
      materials: cleanLines,
      destination: form.destination ?? null,
      notes: form.notes ?? null
    };
    if (form.id) await updateRequest(form.id, payload, user?.id);
    else await createRequest(payload, user?.id);
    setOpen(false);
    refreshData();
  }

  async function setStatus(r: LogisticsRequest, to: LogisticsRequestStatus) {
    const note = window.prompt(`Nota para el cambio a "${requestStatusMeta[to].label}" (opcional):`) ?? undefined;
    try {
      await changeRequestStatus(r.id, to, note, user?.id);
      refreshData();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    }
  }

  async function remove(r: LogisticsRequest) {
    if (!window.confirm(`Eliminar peticion ${r.requestCode}?`)) return;
    await removeRequest(r.id);
    refreshData();
  }

  async function showHistory(r: LogisticsRequest) {
    setHistoryFor(r);
    setHistory(await listHistory(r.id));
  }

  return (
    <div>
      <PageHeader
        title="Peticiones logisticas"
        subtitle="Modulo central de peticiones. Gestores crean; almacen y administracion gestionan estados."
        actions={canCreate ? <Button onClick={create}>+ Nueva peticion</Button> : undefined}
      />

      {!requests?.length ? (
        <EmptyState message="No hay peticiones." />
      ) : (
        <Table headers={["Codigo", "Cliente / Campana", "Prioridad", "Estado", "Necesaria", "Origen", ""]}>
          {requests.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap font-mono text-xs">{r.requestCode}</Td>
              <Td>
                {catalog.clientName(r.clientId)}
                <div className="text-xs text-gray-400">{catalog.campaignName(r.campaignId)}</div>
              </Td>
              <Td><Badge tone={priorityMeta[r.priority].tone}>{priorityMeta[r.priority].label}</Badge></Td>
              <Td><Badge tone={requestStatusMeta[r.status].tone}>{requestStatusMeta[r.status].label}</Badge></Td>
              <Td className="whitespace-nowrap">{formatDate(r.neededByDate)}</Td>
              <Td><Badge tone={r.sourceSystem === "merchanops" ? "purple" : "gray"}>{r.sourceSystem}</Badge></Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Button variant="secondary" onClick={() => showHistory(r)}>Historial</Button>
                  {canManage ? <Button variant="secondary" onClick={() => edit(r)}>Editar</Button> : null}
                  {canChangeStatus
                    ? requestStatusMeta[r.status].next.map((s) => (
                        <Button key={s} variant="ghost" onClick={() => setStatus(r, s)}>→ {requestStatusMeta[s].label}</Button>
                      ))
                    : null}
                  {canDelete ? <Button variant="danger" onClick={() => remove(r)}>Eliminar</Button> : null}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {/* Modal crear/editar */}
      <Modal title={form.id ? `Editar ${form.requestCode}` : "Nueva peticion"} open={open} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><ErrorText errors={errors} /></div>
          <Field label="Codigo"><Input value={form.requestCode ?? ""} readOnly /></Field>
          <Field label="Prioridad">
            <Select value={form.priority ?? "normal"} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
              {priorities.map((p) => <option key={p} value={p}>{priorityMeta[p].label}</option>)}
            </Select>
          </Field>
          <Field label="Cliente / CECO">
            <Select value={form.clientId ?? ""} onChange={(e) => setForm({ ...form, clientId: e.target.value, campaignId: null, serviceId: null })}>
              <option value="">Selecciona cliente</option>
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
          <Field label="Asignada a (almacen)">
            <Select value={form.assignedTo ?? ""} onChange={(e) => setForm({ ...form, assignedTo: e.target.value || null })}>
              <option value="">(sin asignar)</option>
              {catalog.users.filter((u) => u.role !== "gestor").map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </Select>
          </Field>
          <Field label="Necesaria para">
            <Input type="date" value={isoToDateInput(form.neededByDate)} onChange={(e) => setForm({ ...form, neededByDate: dateInputToIso(e.target.value) })} />
          </Field>
          <Field label="Estado">
            <Select value={form.status ?? "borrador"} onChange={(e) => setForm({ ...form, status: e.target.value as LogisticsRequestStatus })} disabled={!!form.id}>
              {(Object.keys(requestStatusMeta) as LogisticsRequestStatus[]).map((s) => <option key={s} value={s}>{requestStatusMeta[s].label}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Destino"><Input value={form.destination ?? ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></Field>
          </div>

          {/* Lineas de material */}
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Materiales</span>
              <Button variant="secondary" onClick={addLine}>+ Anadir material</Button>
            </div>
            {lines.length === 0 ? <p className="text-xs text-gray-400">Sin materiales anadidos.</p> : null}
            <div className="flex flex-col gap-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-md border border-gray-200 p-2">
                  <div className="col-span-6">
                    <Select value={l.materialId} onChange={(e) => updateLine(i, { materialId: e.target.value })} className="w-full">
                      <option value="">Selecciona material</option>
                      {materialsForClient.map((m) => <option key={m.id} value={m.id}>{m.name} (stock {m.currentStock})</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={1} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-3">
                    <Input placeholder="Notas" value={l.notes ?? ""} onChange={(e) => updateLine(i, { notes: e.target.value })} />
                  </div>
                  <div className="col-span-1">
                    <Button variant="danger" onClick={() => removeLine(i)}>✕</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <Field label="Observaciones"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal historial */}
      <Modal title={`Historial ${historyFor?.requestCode ?? ""}`} open={!!historyFor} onClose={() => setHistoryFor(null)}>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">Sin cambios registrados.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="rounded-md border border-gray-200 p-2">
                <div className="flex items-center gap-2">
                  {h.fromStatus ? <Badge tone={requestStatusMeta[h.fromStatus].tone}>{requestStatusMeta[h.fromStatus].label}</Badge> : <span className="text-xs text-gray-400">inicio</span>}
                  <span>→</span>
                  <Badge tone={requestStatusMeta[h.toStatus].tone}>{requestStatusMeta[h.toStatus].label}</Badge>
                </div>
                <div className="mt-1 text-xs text-gray-500">{formatDateTime(h.createdAt)} · {h.note || "sin nota"}</div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
