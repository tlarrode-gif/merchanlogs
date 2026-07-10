"use client";

/**
 * Materiales · Piezas VIN (rediseño, mockup image4): seguimiento unitario y
 * trazabilidad global de piezas individuales. Cada fila es una pieza unica;
 * al seleccionarla se abre el panel lateral con toda su trazabilidad (entrada,
 * import, picking, envio, incidencia).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { MaterialItemStatus } from "@/types";
import { listMaterialItems } from "@/services/material-items.service";
import { getAdapter } from "@/services/adapter";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { Chip, Empty, PageHeader, Panel } from "@/components/lg";
import { NoAccess } from "@/components/ui";
import { materialItemStatusMeta } from "@/lib/status";
import { MaterialsTabs } from "@/components/materials-tabs";

/** Contadores del pie (mockup image4). */
const FOOT_COUNTERS: Array<{ label: string; statuses: MaterialItemStatus[]; tone?: string }> = [
  { label: "Sin producir", statuses: ["pendiente_produccion"] },
  { label: "Pdte. recepción", statuses: ["pendiente_recepcion"] },
  { label: "En almacén", statuses: ["recibido"] },
  { label: "Reservado / picking", statuses: ["reservado"] },
  { label: "Preparado", statuses: ["preparado"] },
  { label: "Enviado", statuses: ["enviado"] },
  { label: "Instalado", statuses: ["instalado"] },
  { label: "Incidencias", statuses: ["incidencia", "duplicado"], tone: "danger" }
];

const LEGEND_COLORS: Record<string, string> = {
  gray: "#94a3b8", blue: "#3b82f6", cyan: "#06b6d4", green: "#16a34a",
  amber: "#d97706", red: "#dc2626", purple: "#8b5cf6"
};

export default function PiezasPage() {
  const { can } = useSession();
  const { data } = useData(async () => {
    const adapter = getAdapter();
    const [items, pickings, shipments, incidents, entries] = await Promise.all([
      listMaterialItems(),
      adapter.list("pickingBatches"),
      adapter.list("shipments"),
      adapter.list("incidents"),
      adapter.list("stockEntries")
    ]);
    return { items, pickings, shipments, incidents, entries };
  }, []);
  const { catalog } = useCatalog();

  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [installer, setInstaller] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const installers = useMemo(
    () => Array.from(new Set(items.map((i) => i.installer).filter(Boolean))) as string[],
    [items]
  );
  const campaigns = useMemo(
    () => Array.from(new Set(items.map((i) => i.campaignId).filter(Boolean))) as string[],
    [items]
  );

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const text = `${i.itemCode} ${i.name ?? ""} ${i.pointOfSaleName ?? ""} ${i.city ?? ""} ${i.province ?? ""}`.toLowerCase();
        return (
          (!q || text.includes(q.toLowerCase())) &&
          (!clientId || i.clientId === clientId) &&
          (!campaignId || i.campaignId === campaignId) &&
          (!installer || i.installer === installer) &&
          (!status || i.status === status)
        );
      }),
    [items, q, clientId, campaignId, installer, status]
  );

  const selected = filtered.find((i) => i.id === selectedId) ?? null;

  if (!can("materials.view")) return <NoAccess />;

  const trace = selected && data
    ? {
        picking: selected.pickingBatchId ? data.pickings.find((p) => p.id === selected.pickingBatchId) : null,
        shipment: selected.shipmentId ? data.shipments.find((s) => s.id === selected.shipmentId) : null,
        incident: selected.incidentId ? data.incidents.find((x) => x.id === selected.incidentId) : null,
        entry: selected.stockEntryId ? data.entries.find((e) => e.id === selected.stockEntryId) : null
      }
    : null;

  return (
    <div className="space-y-4">
      <MaterialsTabs />
      <PageHeader
        title="Piezas (VIN)"
        subtitle="Seguimiento unitario y trazabilidad global de elementos — cada código es una pieza única"
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="lg-input pl-9" placeholder="Buscar por VIN, farmacia o localidad..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <span className="lg-label">Cliente</span>
          <select className="lg-select w-40" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Todos</option>
            {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <span className="lg-label">Campaña</span>
          <select className="lg-select w-40" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Todas</option>
            {campaigns.map((c) => <option key={c} value={c}>{catalog.campaignName(c)}</option>)}
          </select>
        </div>
        <div>
          <span className="lg-label">Estado</span>
          <select className="lg-select w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(materialItemStatusMeta).map(([s, meta]) => <option key={s} value={s}>{meta.label}</option>)}
          </select>
        </div>
        <div>
          <span className="lg-label">Instalador</span>
          <select className="lg-select w-40" value={installer} onChange={(e) => setInstaller(e.target.value)}>
            <option value="">Todos</option>
            {installers.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_340px]">
        <Panel title={`Mostrando ${filtered.length} de ${items.length} piezas`}>
          {!filtered.length ? (
            <Empty>No hay piezas con estos filtros. Usa la pestaña Carga masiva para importar.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="lg-table">
                <thead>
                  <tr>
                    <th>VIN / ID</th>
                    <th>Cliente / Campaña</th>
                    <th>Elemento</th>
                    <th>Medidas</th>
                    <th>Localidad</th>
                    <th>Destino</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className={`cursor-pointer ${selected?.id === i.id ? "lg-row-active" : ""}`} onClick={() => setSelectedId(i.id)}>
                      <td className="whitespace-nowrap font-bold text-blue-700">{i.itemCode}</td>
                      <td>
                        <p className="text-xs font-semibold">{catalog.clientName(i.clientId) || "—"}</p>
                        <p className="text-[10px] text-slate-400">{i.campaignId ? catalog.campaignName(i.campaignId) || i.campaignId : "—"}</p>
                      </td>
                      <td className="text-xs">{i.name || `Vinilo ${i.type}`}</td>
                      <td className="text-xs text-slate-500">{i.widthCm && i.heightCm ? `${i.widthCm} × ${i.heightCm}` : "—"}</td>
                      <td className="text-xs">{i.city || i.province || "—"}</td>
                      <td className="max-w-[140px] truncate text-xs">{i.pointOfSaleName || "—"}</td>
                      <td><Chip tone={materialItemStatusMeta[i.status].tone}>{materialItemStatusMeta[i.status].label}</Chip></td>
                      <td><ChevronRight className="h-4 w-4 text-blue-500" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {selected && trace && (
          <Panel
            title={<span className="text-blue-700">{selected.itemCode}</span>}
            actions={<Chip tone={materialItemStatusMeta[selected.status].tone}>{materialItemStatusMeta[selected.status].label}</Chip>}
            className="xl:sticky xl:top-16"
          >
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-bold">{selected.name || `Vinilo ${selected.itemCode}`}</p>
                <p className="text-xs text-slate-500">
                  {catalog.clientName(selected.clientId) || "—"} · {selected.campaignId ? catalog.campaignName(selected.campaignId) || selected.campaignId : "sin campaña"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {selected.widthCm && selected.heightCm && (<><span className="text-slate-400">Medidas</span><span className="font-semibold">{selected.widthCm} × {selected.heightCm} cm</span></>)}
                {selected.pointOfSaleName && (<><span className="text-slate-400">Destino</span><span className="font-semibold">{selected.pointOfSaleName}</span></>)}
                {(selected.address || selected.city) && (<><span className="text-slate-400">Dirección</span><span>{[selected.address, selected.city, selected.province].filter(Boolean).join(", ")}</span></>)}
                {selected.week && (<><span className="text-slate-400">Semana</span><span className="font-semibold">{selected.week}</span></>)}
                {selected.installer && (<><span className="text-slate-400">Instalador</span><span className="font-semibold">{selected.installer}</span></>)}
                {selected.location && (<><span className="text-slate-400">Ubicación</span><span>📍 {selected.location}</span></>)}
              </div>

              <div>
                <p className="lg-kpi-label mb-2">Trazabilidad</p>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Entrada</span>
                    {trace.entry ? (
                      <Link href="/entradas" className="font-semibold text-blue-700 hover:underline">{trace.entry.deliveryNote || "entrada registrada"}</Link>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Picking</span>
                    {trace.picking ? (
                      <Link href={`/picking?id=${trace.picking.id}`} className="font-semibold text-blue-700 hover:underline">{trace.picking.pickingCode}</Link>
                    ) : (
                      <span className="text-slate-300">sin picking</span>
                    )}
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Envío</span>
                    {trace.shipment ? (
                      <Link href={`/envios?id=${trace.shipment.id}`} className="font-semibold text-blue-700 hover:underline">{trace.shipment.shipmentCode}</Link>
                    ) : (
                      <span className="text-slate-300">sin envío</span>
                    )}
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Incidencia</span>
                    {trace.incident ? (
                      <Link href={`/incidencias?id=${trace.incident.id}`} className="font-semibold text-red-600 hover:underline">{trace.incident.incidentCode}</Link>
                    ) : (
                      <span className="text-slate-300">sin incidencias</span>
                    )}
                  </li>
                </ul>
              </div>

              {selected.notes && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{selected.notes}</p>}
            </div>
          </Panel>
        )}
      </div>

      {/* Contadores por estado + leyenda (pie del mockup) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {FOOT_COUNTERS.map((c) => {
          const count = items.filter((i) => c.statuses.includes(i.status)).length;
          return (
            <div key={c.label} className={`lg-card p-3 ${c.tone === "danger" && count > 0 ? "border-red-200 bg-red-50/50" : ""}`}>
              <p className="lg-kpi-label">{c.label}</p>
              <p className={`mt-0.5 text-2xl font-extrabold ${c.tone === "danger" && count > 0 ? "text-red-600" : ""}`}>{count}</p>
            </div>
          );
        })}
      </div>

      <Panel title="Leyenda de estados de las piezas">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {Object.entries(materialItemStatusMeta).map(([key, meta]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEGEND_COLORS[meta.tone] ?? "#94a3b8" }} />
              {meta.label}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
