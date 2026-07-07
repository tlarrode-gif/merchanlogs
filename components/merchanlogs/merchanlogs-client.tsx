"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { createPickingFromRequest, LogisticsRequest, LogisticsState, available, logisticsAlerts, logisticsKpis, materialName, seedLogistics } from "@/lib/logistics";
import { loadLogisticsState, saveLogisticsState } from "@/lib/logistics-store";
import { acceptRequestAndReserve, detectLogisticsSyncIssues, materialDisplay } from "@/lib/logistics-sync";
import { retryFailedIntegrationEvents } from "@/lib/domain-events";

export type MerchanlogsModule = "dashboard" | "inventario" | "ubicaciones" | "movimientos" | "solicitudes" | "picking" | "envios" | "recogidas" | "incidencias" | "sincronizacion" | "administracion";

const moduleTitle: Record<MerchanlogsModule, string> = {
  dashboard: "Dashboard", inventario: "Inventario", ubicaciones: "Ubicaciones", movimientos: "Movimientos", solicitudes: "Solicitudes", picking: "Picking", envios: "Envíos", recogidas: "Recogidas", incidencias: "Incidencias", sincronizacion: "Sincronización", administracion: "Administración"
};

export function MerchanlogsClient({ module }: { module: MerchanlogsModule }) {
  const [state, setState] = useState<LogisticsState>(() => seedLogistics());
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);

  async function refresh() {
    setLoading(true);
    const loaded = await loadLogisticsState();
    setState(loaded.state);
    setRemote(loaded.remote);
    setError(loaded.error ? `Modo local: ${loaded.error}` : "");
    setLoading(false);
  }

  async function commit(mutator: (draft: LogisticsState) => void, success: string) {
    setSaving(true);
    try {
      const draft = structuredClone(state) as LogisticsState;
      mutator(draft);
      await saveLogisticsState(draft, remote);
      setState(draft);
      setMessage(success);
      setError("");
      setTimeout(() => setMessage(""), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la operación");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">MerchanLOGS</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">{moduleTitle[module]}</h2>
          <p className="mt-1 text-sm text-slate-500">{remote ? "Conectado a Supabase" : "Modo local sin Supabase"}{loading ? " · cargando" : ""}</p>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 xl:max-w-md">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar SKU, VIN, solicitud, cliente, estado..." className="w-full bg-transparent text-sm outline-none" />
        </div>
      </header>

      {(message || error) && <div className={error ? "rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" : "rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"}>{error || message}</div>}

      {module === "dashboard" && <Dashboard state={state} />}
      {module === "inventario" && <Inventory state={state} query={query} />}
      {module === "solicitudes" && <Requests state={state} query={query} saving={saving} commit={commit} />}
      {module === "sincronizacion" && <Synchronization state={state} query={query} saving={saving} commit={commit} />}
      {module === "movimientos" && <Movements state={state} query={query} />}
      {module === "ubicaciones" && <WarehouseMap state={state} />}
      {module === "picking" && <SimpleList title="Pickings" empty="Aún no hay pickings creados." rows={state.pickings.filter(row => matches([row.codigo, row.estado, row.zona, row.campana_id], query)).map(row => ({ id: row.id, main: row.codigo, meta: `${row.estado} · ${row.zona || "Sin zona"} · ${row.lineas.length} líneas` }))} />}
      {module === "envios" && <SimpleList title="Envíos" empty="Aún no hay envíos creados." rows={state.shipments.filter(row => matches([row.tracking, row.estado, row.transportista], query)).map(row => ({ id: row.id, main: row.tracking || row.id, meta: `${row.estado} · ${row.transportista || "Sin transportista"} · ${row.fecha_estimada_entrega || "Sin fecha"}` }))} />}
      {module === "recogidas" && <Placeholder title="Recogidas" text="Base preparada para registrar recogidas, devoluciones y retornos de instalador." />}
      {module === "incidencias" && <SimpleList title="Incidencias" empty="No hay incidencias abiertas." rows={state.incidents.filter(row => matches([row.codigo, row.estado, row.tipo, row.descripcion], query)).map(row => ({ id: row.id, main: `${row.codigo} · ${row.tipo}`, meta: `${row.estado} · ${row.descripcion}` }))} />}
      {module === "administracion" && <Admin state={state} />}
    </div>
  );
}

function Dashboard({ state }: { state: LogisticsState }) {
  const kpis = logisticsKpis(state);
  const stockTotal = state.stock.reduce((sum, row) => sum + row.cantidad_fisica, 0);
  const inTransit = state.shipments.filter(row => ["recogido", "en_transito"].includes(row.estado)).length;
  const cards = [
    ["Stock total", stockTotal], ["Referencias activas", state.materials.filter(material => material.activo).length], ["Solicitudes abiertas", kpis.openRequests], ["Pickings pendientes", kpis.pendingPickings], ["Envíos en tránsito", inTransit], ["Incidencias abiertas", kpis.openIncidents], ["Bajo mínimo", kpis.lowStock], ["Errores sync", kpis.syncErrors]
  ];
  const alerts = logisticsAlerts(state);
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}</section>
      <Card title="Alertas operativas">{alerts.length ? alerts.slice(0, 8).map(alert => <div key={alert.text} className="border-t border-slate-100 py-3 text-sm"><Tone tone={alert.level} /> <b>{alert.text}</b></div>) : <Empty text="Sin alertas críticas." />}</Card>
      <WarehouseMap state={state} compact />
    </div>
  );
}

function Inventory({ state, query }: { state: LogisticsState; query: string }) {
  const rows = state.materials.map(material => ({ material, stock: state.stock.find(row => row.material_id === material.id) })).filter(row => matches([row.material.sku, row.material.nombre, row.material.cliente_id, row.material.tipo, row.material.medidas], query));
  return <Card title="Inventario"><Table headers={["SKU", "Material", "Cliente", "Tipo", "Medidas", "Físico", "Reservado", "Picking", "Bloqueado", "Disponible", "Mínimo", "Estado"]}>{rows.map(({ material, stock }) => { const free = available(stock); return <tr key={material.id} className="border-t"><td className="p-3 font-mono text-xs">{material.sku}</td><td className="p-3 font-bold">{material.nombre}</td><td className="p-3">{material.cliente_id || "-"}</td><td className="p-3">{material.tipo}</td><td className="p-3">{material.medidas || "-"}</td><td className="p-3">{stock?.cantidad_fisica || 0}</td><td className="p-3">{stock?.cantidad_reservada || 0}</td><td className="p-3">{stock?.cantidad_picking || 0}</td><td className="p-3">{stock?.cantidad_bloqueada || 0}</td><td className="p-3 font-black">{free}</td><td className="p-3">{material.stock_minimo}</td><td className="p-3"><Status status={free < material.stock_minimo ? "Bajo mínimo" : "OK"} /></td></tr>; })}</Table></Card>;
}

function Requests({ state, query, saving, commit }: { state: LogisticsState; query: string; saving: boolean; commit: (mutator: (draft: LogisticsState) => void, success: string) => Promise<void> }) {
  const rows = state.requests.filter(row => matches([row.code, row.source_type, row.status, row.priority, row.installer_name, row.delivery_address, row.campaign_id], query));
  return <Card title="Solicitudes"><Table headers={["Código", "Origen", "Cliente/Campaña", "Estado", "Urgencia", "Material", "Cantidad", "Destino", "Fecha", "Picking", "Acciones"]}>{rows.map(request => { const req = firstRequirement(state, request); const qty = request.lines.reduce((sum, line) => sum + Number(line.requested_quantity || 0), 0); return <tr key={request.id} className="border-t align-top"><td className="p-3 font-mono text-xs">{request.code}</td><td className="p-3">{request.source_type}</td><td className="p-3">{request.client_id || "-"}<br /><span className="text-xs text-slate-400">{request.campaign_id || "Sin campaña"}</span></td><td className="p-3"><Status status={request.status} /></td><td className="p-3">{request.priority}</td><td className="p-3">{req ? materialDisplay(req, state) : "Sin material"}</td><td className="p-3">{qty}</td><td className="p-3">{request.installer_name || request.delivery_address || "Sin destino"}</td><td className="p-3">{request.required_date || "-"}</td><td className="p-3">{request.picking_id || "-"}</td><td className="p-3"><div className="flex gap-2"><button disabled={saving || !canReserve(request)} onClick={() => commit(draft => acceptRequestAndReserve(draft, request.id, "MerchanLOGS"), "Solicitud aprobada")} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">Aprobar</button><button disabled={saving || !!request.picking_id || ["rechazada", "cancelada", "bloqueada", "entregada", "cerrada"].includes(request.status)} onClick={() => commit(draft => createPickingFromRequest(draft, request.id, "MerchanLOGS"), "Picking creado")} className="rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">Picking</button></div></td></tr>; })}</Table>{!rows.length && <Empty text="No hay solicitudes para este filtro." />}</Card>;
}

function Synchronization({ state, query, saving, commit }: { state: LogisticsState; query: string; saving: boolean; commit: (mutator: (draft: LogisticsState) => void, success: string) => Promise<void> }) {
  const issues = detectLogisticsSyncIssues(state).filter(issue => matches([issue.text, issue.fix, issue.severity], query));
  const events = state.events.filter(event => matches([event.event_type, event.source_type, event.source_id, event.status, event.last_error], query));
  const logs = state.syncLogs.filter(log => matches([log.evento, log.origen_modulo, log.destino_modulo, log.resultado, log.error_message], query));
  return <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-4">{[["Pendientes", state.events.filter(e => e.status === "pendiente").length], ["Procesando", state.events.filter(e => e.status === "procesando").length], ["Completados", state.events.filter(e => e.status === "completado").length], ["Con error", state.events.filter(e => e.status === "error").length]].map(([label, value]) => <section key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="text-3xl font-black">{value}</p></section>)}</section><Card title="Diagnóstico" action={<button disabled={saving || !state.events.some(event => event.status === "error")} onClick={() => commit(draft => { retryFailedIntegrationEvents(draft); }, "Eventos reintentados")} className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-40"><RefreshCw className="mr-1 inline h-4 w-4" />Reintentar errores</button>}>{issues.length ? issues.map(issue => <div key={issue.id} className="border-t border-slate-100 py-3 text-sm"><Tone tone={issue.severity} /> <b>{issue.text}</b><p className="mt-1 text-slate-500">{issue.fix || "Revisión manual recomendada."}</p></div>) : <Empty text="No se detectan incidencias de sincronización." />}</Card><Card title="Eventos">{events.slice(0, 80).map(event => <div key={event.id} className="border-t border-slate-100 py-2 text-sm"><b>{event.event_type}</b> · {event.source_type} · <Status status={event.status} /><p className="text-xs text-slate-500">{event.last_error || summarize(event.payload)}</p></div>)}{!events.length && <Empty text="Sin eventos." />}</Card><Card title="Sync logs">{logs.slice(0, 60).map(log => <div key={log.id} className="border-t border-slate-100 py-2 text-xs"><b>{log.evento}</b> · {log.origen_modulo} {"->"} {log.destino_modulo} · {log.resultado}<p className="text-slate-500">{new Date(log.created_at).toLocaleString("es-ES")}{log.error_message ? ` · ${log.error_message}` : ""}</p></div>)}{!logs.length && <Empty text="Sin logs." />}</Card></div>;
}

function Movements({ state, query }: { state: LogisticsState; query: string }) {
  const rows = state.movements.filter(row => matches([row.tipo, row.material_id, row.origen, row.destino, row.motivo, row.vin_id], query));
  return <Card title="Movimientos"><Table headers={["Fecha", "Tipo", "Material", "Cantidad", "Origen", "Destino", "Motivo"]}>{rows.slice(0, 120).map(row => <tr key={row.id} className="border-t"><td className="p-3">{new Date(row.created_at).toLocaleString("es-ES")}</td><td className="p-3"><Status status={row.tipo} /></td><td className="p-3">{materialName(state, row.material_id)}</td><td className="p-3 font-black">{row.cantidad}</td><td className="p-3">{row.origen || "-"}</td><td className="p-3">{row.destino || "-"}</td><td className="p-3">{row.motivo}</td></tr>)}</Table>{!rows.length && <Empty text="Sin movimientos." />}</Card>;
}

function WarehouseMap({ state, compact = false }: { state: LogisticsState; compact?: boolean }) {
  const zones = [{ name: "Recepción", value: state.entries.filter(row => row.estado === "pendiente").length }, { name: "Stock activo", value: state.materials.filter(row => row.activo).length }, { name: "Picking", value: state.pickings.filter(row => ["pendiente", "en_preparacion"].includes(row.estado)).length }, { name: "Bloqueado", value: state.stock.reduce((sum, row) => sum + row.cantidad_bloqueada, 0) }, { name: "Tránsito", value: state.shipments.filter(row => ["recogido", "en_transito"].includes(row.estado)).length }, { name: "Reposición", value: state.pendings.filter(row => !["cerrado", "recibido"].includes(row.estado)).length }];
  return <Card title="Mapa operativo de almacén"><div className={`grid gap-3 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3"}`}>{zones.map(zone => <div key={zone.name} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-600">{zone.name}</p><p className="mt-3 text-3xl font-black">{zone.value}</p></div>)}</div></Card>;
}

function Admin({ state }: { state: LogisticsState }) {
  return <Card title="Administración"><p className="text-sm text-slate-500">Contratos espejo preparados para MerchanOPS. Eventos: {state.events.length}. Logs: {state.syncLogs.length}.</p>{["services.logistics_status", "services.logistics_request_id", "services.logistics_last_sync_at", "services.logistics_sync_event_id", "services.material_status", "services.tracking", "points.logistics_status", "isdin_vinyls.logistics_status"].map(item => <div key={item} className="border-t border-slate-100 py-2 text-sm"><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" />{item}</div>)}</Card>;
}

function Placeholder({ title, text }: { title: string; text: string }) { return <Card title={title}><Empty text={text} /></Card>; }
function SimpleList({ title, empty, rows }: { title: string; empty: string; rows: Array<{ id: string; main: string; meta: string }> }) { return <Card title={title}>{rows.map(row => <div key={row.id} className="border-t border-slate-100 py-3"><p className="font-bold">{row.main}</p><p className="text-sm text-slate-500">{row.meta}</p></div>)}{!rows.length && <Empty text={empty} />}</Card>; }
function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-black">{title}</h3>{action}</div>{children}</section>; }
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="soft-scrollbar overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] text-sm"><thead><tr className="bg-slate-950 text-left text-white">{headers.map(header => <th key={header} className="p-3 font-bold">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>; }
function Status({ status }: { status: string }) { const lower = status.toLowerCase(); const tone = lower.includes("error") || lower.includes("rechazada") || lower.includes("bloque") || lower.includes("incid") ? "bg-red-50 text-red-800 ring-red-200" : lower.includes("entreg") || lower.includes("complet") || lower.includes("acept") || lower === "ok" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : lower.includes("prepar") || lower.includes("picking") || lower.includes("envi") ? "bg-blue-50 text-blue-800 ring-blue-200" : "bg-amber-50 text-amber-800 ring-amber-200"; return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ring-1 ${tone}`}>{status}</span>; }
function Tone({ tone }: { tone: string }) { return tone === "critica" ? <AlertTriangle className="inline h-4 w-4 text-red-600" /> : <AlertTriangle className="inline h-4 w-4 text-amber-500" />; }
function firstRequirement(state: LogisticsState, request: LogisticsRequest) { return request.lines.map(line => state.requirements.find(req => req.id === line.material_requirement_id)).find(Boolean); }
function canReserve(request: LogisticsRequest) { return !["aceptada", "en_preparacion", "preparada", "enviada_transporte", "entregada", "cerrada", "rechazada"].includes(request.status); }
function matches(values: unknown[], query: string) { const q = query.trim().toLowerCase(); if (!q) return true; return values.some(value => String(value ?? "").toLowerCase().includes(q)); }
function summarize(payload: Record<string, unknown>) { const text = JSON.stringify(payload); return text.length > 180 ? `${text.slice(0, 180)}...` : text; }
