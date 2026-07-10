"use client";

/**
 * Peticiones (rediseño): bandeja de entrada del almacen. Lista maestro-detalle
 * con KPIs, y flujo de 1 clic "Aceptar y generar picking": reserva el stock
 * disponible, crea el picking y deja la peticion en preparando (o en
 * pendiente_material si falta stock en alguna linea).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarClock, CheckCircle2, ClipboardList, History, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { LogisticsRequest, LogisticsRequestLine, LogisticsRequestStatus, Priority, RequestHistoryEntry } from "@/types";
import {
  listRequests, createRequest, updateRequest, removeRequest, changeRequestStatus,
  validateRequest, nextRequestCode, listHistory
} from "@/services/requests.service";
import { acceptRequestAndCreatePicking, listPickingBatches } from "@/services/picking.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { useCampaignFilter } from "@/app/app-shell";
import { Chip, Empty, Kpi, PageHeader, Panel, PriorityChip, Progress } from "@/components/lg";
import { Button, ErrorText, Field, Input, Modal, NoAccess, Select, Textarea } from "@/components/ui";
import { priorityMeta, requestStatusMeta } from "@/lib/status";
import { formatDate, formatDateTime, isoToDateInput, dateInputToIso, nowIso } from "@/lib/dates";

const priorities: Priority[] = ["baja", "normal", "alta", "urgente"];
const OPEN_STATUSES: LogisticsRequestStatus[] = ["solicitada", "en_revision", "pendiente_material"];

export default function PeticionesPage() {
  const { can, user, refreshData } = useSession();
  const { campaignId } = useCampaignFilter();
  const search = useSearchParams();
  const { data: requests } = useData(() => listRequests(), []);
  const { data: pickings } = useData(() => listPickingBatches(), []);
  const { catalog } = useCatalog();

  const [selectedId, setSelectedId] = useState<string | null>(search.get("id"));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<LogisticsRequest>>({});
  const [lines, setLines] = useState<LogisticsRequestLine[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [historyFor, setHistoryFor] = useState<LogisticsRequest | null>(null);
  const [history, setHistory] = useState<RequestHistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const rows = (requests ?? []).filter((r) => !campaignId || r.campaignId === campaignId);
    return rows.sort((a, b) => (b.requestedDate || "").localeCompare(a.requestedDate || ""));
  }, [requests, campaignId]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered.find((r) => OPEN_STATUSES.includes(r.status)) ?? filtered[0] ?? null;
  const pickingFor = (r: LogisticsRequest | null) =>
    r ? (pickings ?? []).find((p) => p.logisticsRequestId === r.id && p.status !== "cancelado") ?? null : null;

  if (!can("requests.view")) return <NoAccess />;
  const canCreate = can("requests.create");
  const canManage = can("requests.manage");
  const canChangeStatus = can("requests.changeStatus") || canManage;
  const canDelete = can("requests.delete");
  const canPick = can("picking.manage") || canManage;

  const kpis = {
    pendientes: filtered.filter((r) => OPEN_STATUSES.includes(r.status)).length,
    preparando: filtered.filter((r) => r.status === "preparando").length,
    listas: filtered.filter((r) => r.status === "lista_para_envio").length,
    enviadas: filtered.filter((r) => ["enviada", "entregada"].includes(r.status)).length
  };

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 3500);
  }

  async function acceptOneClick(r: LogisticsRequest) {
    setBusy(true);
    try {
      const result = await acceptRequestAndCreatePicking(r, user?.id);
      flash(
        result.shortages.length
          ? `Picking ${result.batch.pickingCode} creado. Falta stock en ${result.shortages.length} línea(s): la petición queda pendiente de material.`
          : `Picking ${result.batch.pickingCode} creado y stock reservado. Petición en preparación.`
      );
      setSelectedId(r.id);
      refreshData();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error al aceptar la petición");
    } finally {
      setBusy(false);
    }
  }

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

  const selectedPicking = pickingFor(selected);
  const preparedPct = selected?.materials.length
    ? Math.round(
        (selected.materials.reduce((s, l) => s + Math.min(l.preparedQuantity, l.quantity), 0) /
          Math.max(1, selected.materials.reduce((s, l) => s + l.quantity, 0))) * 100
      )
    : 0;

  return (
    <div className="space-y-4">
      {notice && (
        <div className="fixed right-4 top-16 z-50 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 shadow-lg">
          {notice}
        </div>
      )}
      <PageHeader
        title="Peticiones"
        subtitle="Bandeja de entrada del almacén: solicitudes de OPS y peticiones manuales"
        actions={canCreate ? (
          <button className="lg-btn lg-btn-primary" onClick={create}>
            <Plus className="h-4 w-4" /> Nueva petición
          </button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Pendientes de aceptar" value={kpis.pendientes} tone={kpis.pendientes ? "danger" : "default"} icon={<Inbox className="h-4 w-4" />} />
        <Kpi label="En preparación" value={kpis.preparando} tone="blue" icon={<ClipboardList className="h-4 w-4" />} />
        <Kpi label="Listas para envío" value={kpis.listas} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Kpi label="Enviadas / entregadas" value={kpis.enviadas} tone="ok" icon={<CalendarClock className="h-4 w-4" />} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_380px]">
        <Panel title={`Listado de peticiones (${filtered.length})`}>
          {!filtered.length ? (
            <Empty>No hay peticiones{campaignId ? " en esta campaña" : ""}.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="lg-table">
                <thead>
                  <tr>
                    <th>Petición</th>
                    <th>Cliente / Campaña</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Necesaria</th>
                    <th>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={`cursor-pointer ${selected?.id === r.id ? "lg-row-active" : ""}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td className="whitespace-nowrap font-bold text-blue-700">{r.requestCode}</td>
                      <td>
                        <p className="font-medium">{catalog.clientName(r.clientId)}</p>
                        <p className="text-xs text-slate-400">{catalog.campaignName(r.campaignId)}</p>
                      </td>
                      <td><PriorityChip priority={r.priority} /></td>
                      <td><Chip tone={requestStatusMeta[r.status].tone}>{requestStatusMeta[r.status].label}</Chip></td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{formatDate(r.neededByDate)}</td>
                      <td><Chip tone={r.sourceSystem === "merchanops" ? "violet" : "gray"}>{r.sourceSystem === "merchanops" ? "OPS" : "LOGS"}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {selected && (
          <Panel
            title={<span className="text-blue-700">{selected.requestCode}</span>}
            actions={<Chip tone={requestStatusMeta[selected.status].tone}>{requestStatusMeta[selected.status].label}</Chip>}
            className="xl:sticky xl:top-16"
          >
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-bold">{catalog.clientName(selected.clientId)}</p>
                <p className="text-xs text-slate-500">
                  {catalog.campaignName(selected.campaignId)} · <PriorityChip priority={selected.priority} />
                </p>
                {selected.destination && <p className="mt-1 text-xs text-slate-500">Destino: {selected.destination}</p>}
                {selected.neededByDate && <p className="text-xs text-slate-500">Necesaria: {formatDate(selected.neededByDate)}</p>}
                {selected.notes && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{selected.notes}</p>}
              </div>

              {/* Accion principal: 1 clic */}
              {canPick && OPEN_STATUSES.includes(selected.status) && !selectedPicking && (
                <button className="lg-btn lg-btn-blue w-full" disabled={busy || !selected.materials.length} onClick={() => acceptOneClick(selected)}>
                  <CheckCircle2 className="h-4 w-4" />
                  {busy ? "Procesando..." : "Aceptar y generar picking"}
                </button>
              )}
              {selectedPicking && (
                <Link href={`/picking?id=${selectedPicking.id}`} className="lg-btn lg-btn-primary w-full">
                  <ClipboardList className="h-4 w-4" /> Ver picking {selectedPicking.pickingCode}
                </Link>
              )}

              <div>
                <p className="lg-kpi-label mb-2">Materiales de la petición ({selected.materials.length})</p>
                {!selected.materials.length ? (
                  <Empty>Sin líneas de material.</Empty>
                ) : (
                  <ul className="space-y-2">
                    {selected.materials.map((l, i) => {
                      const m = catalog.materials.find((x) => x.id === l.materialId);
                      const available = m ? Math.max(0, (m.currentStock ?? 0) - (m.reservedStock ?? 0)) : 0;
                      const short = available < l.quantity && l.preparedQuantity < l.quantity;
                      return (
                        <li key={i} className="rounded-xl border border-slate-100 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold">{m?.name ?? "(material)"}</p>
                            <Chip tone={short ? "red" : "green"}>{l.preparedQuantity}/{l.quantity}</Chip>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Stock disponible: {available} {m?.unit ?? "ud"} {short && "· insuficiente"}
                          </p>
                          {l.notes && <p className="text-[11px] text-slate-400">{l.notes}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {selected.materials.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500">
                      <span>Progreso de preparación</span>
                      <span>{preparedPct}%</span>
                    </div>
                    <Progress value={preparedPct} tone={preparedPct === 100 ? "green" : "blue"} />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                <button className="lg-btn lg-btn-outline lg-btn-sm" onClick={() => showHistory(selected)}>
                  <History className="h-3.5 w-3.5" /> Historial
                </button>
                {canManage && (
                  <button className="lg-btn lg-btn-outline lg-btn-sm" onClick={() => edit(selected)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
                {canChangeStatus &&
                  requestStatusMeta[selected.status].next.map((s) => (
                    <button key={s} className="lg-btn lg-btn-outline lg-btn-sm" onClick={() => setStatus(selected, s)}>
                      → {requestStatusMeta[s].label}
                    </button>
                  ))}
                {canDelete && (
                  <button className="lg-btn lg-btn-outline lg-btn-sm text-red-600" onClick={() => remove(selected)}>
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                )}
              </div>
            </div>
          </Panel>
        )}
      </div>

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
                  {h.fromStatus ? <Chip tone={requestStatusMeta[h.fromStatus].tone}>{requestStatusMeta[h.fromStatus].label}</Chip> : <span className="text-xs text-gray-400">inicio</span>}
                  <span>→</span>
                  <Chip tone={requestStatusMeta[h.toStatus].tone}>{requestStatusMeta[h.toStatus].label}</Chip>
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
