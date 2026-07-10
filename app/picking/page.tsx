"use client";

/**
 * Gestion de Picking (rediseño, mockup image5): lista maestro-detalle. A la
 * izquierda los pickings con filtros; a la derecha el detalle con checklist de
 * materiales, progreso y acciones (preparar linea, cerrar, enviar a transporte).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckSquare, ChevronRight, ClipboardList, PackageCheck, Printer, Send, Square, Timer } from "lucide-react";
import { PickingBatch } from "@/types";
import {
  listPickingBatches,
  prepareLine,
  cancelLine,
  closePickingBatch,
  changeBatchStatus
} from "@/services/picking.service";
import { createShipmentFromPicking } from "@/services/shipments.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { useCampaignFilter } from "@/app/app-shell";
import { Chip, Empty, Kpi, PageHeader, Panel, Progress } from "@/components/lg";
import { NoAccess } from "@/components/ui";
import { activePickingStatuses, pickingBatchStatusMeta, pickingLineStatusMeta } from "@/lib/status";

export default function PickingPage() {
  const { can, user, refreshData } = useSession();
  const { campaignId } = useCampaignFilter();
  const search = useSearchParams();
  const { data: batches } = useData(() => listPickingBatches(), []);
  const { catalog } = useCatalog();

  const [selectedId, setSelectedId] = useState<string | null>(search.get("id"));
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    let rows = (batches ?? []).filter((b) => !campaignId || b.campaignId === campaignId);
    if (statusFilter === "activos") rows = rows.filter((b) => activePickingStatuses.includes(b.status));
    else if (statusFilter) rows = rows.filter((b) => b.status === statusFilter);
    return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [batches, campaignId, statusFilter]);

  const selected = filtered.find((b) => b.id === selectedId) ?? filtered[0] ?? null;

  if (!can("picking.view")) return <NoAccess />;
  const canManage = can("picking.manage");

  const kpis = {
    pendiente: (batches ?? []).filter((b) => b.status === "pendiente_preparacion").length,
    enPrep: (batches ?? []).filter((b) => b.status === "en_preparacion").length,
    preparados: (batches ?? []).filter((b) => ["preparado_completo", "listo_para_envio"].includes(b.status)).length
  };

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 3500);
  }

  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await action();
      flash(ok);
      refreshData();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLine(batch: PickingBatch, lineId: string, prepared: boolean) {
    await run(
      () => prepareLine(batch.id, lineId, prepared ? undefined : 0, user?.id),
      prepared ? "Línea preparada" : "Línea desmarcada"
    );
  }

  const progress = (b: PickingBatch) => {
    const target = b.lines.filter((l) => l.status !== "cancelada");
    const total = target.reduce((s, l) => s + l.quantity, 0);
    const done = target.reduce((s, l) => s + Math.min(l.preparedQuantity, l.quantity), 0);
    return { done: target.filter((l) => l.status === "preparado").length, total: target.length, pct: total ? Math.round((done / total) * 100) : 0 };
  };

  const selectedProgress = selected ? progress(selected) : null;
  const canClose = selected && ["en_preparacion", "pendiente_preparacion", "preparado_parcial", "preparado_completo"].includes(selected.status);
  const canShip = selected && ["listo_para_envio", "preparado_completo"].includes(selected.status);

  return (
    <div className="space-y-4">
      {notice && (
        <div className="fixed right-4 top-16 z-50 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 shadow-lg">
          {notice}
        </div>
      )}
      <PageHeader title="Gestión de Picking" subtitle="Preparación de material por instalador y campaña" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="Picking pendiente" value={kpis.pendiente} tone={kpis.pendiente ? "danger" : "default"} hint={kpis.pendiente ? "Requiere atención" : undefined} icon={<Timer className="h-4 w-4" />} />
        <Kpi label="En preparación" value={kpis.enPrep} tone="blue" hint="En curso por almacén" icon={<ClipboardList className="h-4 w-4" />} />
        <Kpi label="Preparados" value={kpis.preparados} tone="ok" hint="Listos para transporte" icon={<PackageCheck className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Filtros:</span>
        {[["", "Todos"], ["activos", "Activos"], ["pendiente_preparacion", "Pendientes"], ["en_preparacion", "En preparación"], ["listo_para_envio", "Listos"], ["enviado", "Enviados"]].map(([value, label]) => (
          <button
            key={value}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusFilter === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_400px]">
        <Panel title="Listados de Picking" actions={<span className="text-xs text-slate-400">Mostrando {filtered.length} resultados</span>}>
          {!filtered.length ? (
            <Empty>No hay pickings con este filtro. Acepta una petición para generar el primero.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="lg-table">
                <thead>
                  <tr>
                    <th>Picking</th>
                    <th>Cliente / Campaña</th>
                    <th>Mats / Prep.</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const p = progress(b);
                    return (
                      <tr key={b.id} className={`cursor-pointer ${selected?.id === b.id ? "lg-row-active" : ""}`} onClick={() => setSelectedId(b.id)}>
                        <td>
                          <p className="font-bold">{b.assignedInstaller || catalog.clientName(b.clientId)}</p>
                          <p className="font-mono text-[10px] text-slate-400">{b.pickingCode}</p>
                        </td>
                        <td>
                          <p className="text-xs font-medium">{catalog.clientName(b.clientId)}</p>
                          <p className="text-xs text-slate-400">{catalog.campaignName(b.campaignId)}</p>
                        </td>
                        <td className="whitespace-nowrap text-xs font-semibold">{p.done} / {p.total}</td>
                        <td><Chip tone={pickingBatchStatusMeta[b.status].tone}>{pickingBatchStatusMeta[b.status].label}</Chip></td>
                        <td><ChevronRight className="h-4 w-4 text-blue-500" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {selected && selectedProgress && (
          <Panel
            title={<span className="lg-kpi-label">Detalle de picking</span>}
            actions={<Chip tone="blue">{selected.pickingCode}</Chip>}
            className="xl:sticky xl:top-16"
          >
            <div className="space-y-4">
              <div>
                <p className="text-lg font-extrabold">{selected.assignedInstaller || catalog.clientName(selected.clientId)}</p>
                <p className="text-xs text-slate-500">
                  Campaña: <span className="font-semibold text-blue-700">{catalog.campaignName(selected.campaignId)}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {canManage && selected.status === "pendiente_preparacion" && (
                  <button className="lg-btn lg-btn-primary lg-btn-sm" disabled={busy} onClick={() => run(() => changeBatchStatus(selected.id, "en_preparacion", user?.id), "Picking en preparación")}>
                    ▶ Preparar
                  </button>
                )}
                <Link href={`/picking/${selected.id}/print`} className="lg-btn lg-btn-outline lg-btn-sm">
                  <Printer className="h-3.5 w-3.5" /> Etiqueta
                </Link>
                <Link href={`/picking/${selected.id}`} className="lg-btn lg-btn-outline lg-btn-sm">
                  Detalle completo
                </Link>
              </div>

              <div>
                <p className="lg-kpi-label mb-2">Materiales en la lista ({selected.lines.length})</p>
                <ul className="lg-scroll max-h-80 space-y-2 overflow-y-auto pr-1">
                  {selected.lines.map((l) => {
                    const done = l.status === "preparado";
                    const cancelled = l.status === "cancelada";
                    return (
                      <li key={l.id} className={`rounded-xl border p-2.5 ${done ? "border-blue-200 bg-blue-50/40" : "border-slate-100"} ${cancelled ? "opacity-50" : ""}`}>
                        <div className="flex items-start gap-2.5">
                          {canManage && !cancelled ? (
                            <button disabled={busy} onClick={() => toggleLine(selected, l.id, !done)} className="mt-0.5 text-blue-600">
                              {done ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-300" />}
                            </button>
                          ) : (
                            <Square className="mt-0.5 h-4 w-4 text-slate-200" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-semibold">{l.description}</p>
                              {l.dimensions && <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">{l.dimensions}</span>}
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {l.pointOfSaleName || l.officeName || "—"}
                              {l.location && <> · 📍 {l.location}</>}
                              {" · "}{l.preparedQuantity}/{l.quantity}
                            </p>
                            <Chip tone={pickingLineStatusMeta[l.status].tone}>{pickingLineStatusMeta[l.status].label}</Chip>
                            {canManage && !cancelled && !done && (
                              <button className="ml-2 text-[10px] font-semibold text-red-500 hover:underline" disabled={busy} onClick={() => run(() => cancelLine(selected.id, l.id, user?.id), "Línea cancelada")}>
                                Cancelar línea
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500">
                  <span>Progreso de Picking:</span>
                  <span>{selectedProgress.done} / {selectedProgress.total} ({selectedProgress.pct}%)</span>
                </div>
                <Progress value={selectedProgress.pct} tone={selectedProgress.pct === 100 ? "green" : "blue"} />
              </div>

              {canManage && canClose && (
                <button
                  className="lg-btn lg-btn-primary w-full"
                  disabled={busy}
                  onClick={() => run(() => closePickingBatch(selected.id, user?.id), "Picking cerrado: stock descontado y listo para envío")}
                >
                  <PackageCheck className="h-4 w-4" /> Cerrar picking (descuenta stock)
                </button>
              )}
              {canManage && (
                <button
                  className={`lg-btn w-full ${canShip ? "lg-btn-blue" : "lg-btn-outline"}`}
                  disabled={busy || !canShip}
                  title={canShip ? "Crear envío desde este picking" : "Cierra el picking para poder enviarlo"}
                  onClick={() =>
                    run(async () => {
                      const carrier = window.prompt("Transportista (opcional):") ?? null;
                      await createShipmentFromPicking(selected, { carrier, status: "preparado" }, user?.id);
                    }, "Envío creado desde el picking")
                  }
                >
                  <Send className="h-4 w-4" /> Enviar a Transporte
                </button>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
