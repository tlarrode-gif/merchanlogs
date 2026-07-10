"use client";

/**
 * Reproducciones (mockup image8): ordenes de re-produccion de piezas originadas
 * por incidencias (roturas, medidas incorrectas, material incorrecto...). Se
 * alimenta de las incidencias reales; "reproducir" resuelve la incidencia y
 * deja trazado el motivo.
 */

import { useMemo, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { IncidentType } from "@/types";
import { listIncidents, changeIncidentStatus } from "@/services/incidents.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { useCampaignFilter } from "@/app/app-shell";
import { Chip, Empty, PageHeader, Panel, PriorityChip } from "@/components/lg";
import { NoAccess } from "@/components/ui";
import { incidentStatusMeta } from "@/lib/status";

/** Tipos de incidencia que implican volver a producir la pieza. */
const REPRO_TYPES: IncidentType[] = [
  "rotura",
  "medidas_incorrectas",
  "material_incorrecto",
  "material_no_encaja",
  "material_faltante",
  "material_no_localizado",
  "incidencia_proveedor"
];

const motivoLabel: Record<string, string> = {
  rotura: "Rotura",
  medidas_incorrectas: "Error medidas",
  material_incorrecto: "Incorrecto",
  material_no_encaja: "No encaja",
  material_faltante: "Faltante",
  material_no_localizado: "No localizado",
  incidencia_proveedor: "Defecto proveedor"
};

const filters = [
  ["todas", "Todas"],
  ["pendientes", "Pendientes"],
  ["en_curso", "En producción"],
  ["resueltas", "Enviadas / resueltas"]
] as const;

export default function ReproduccionesPage() {
  const { can, user, refreshData } = useSession();
  const { campaignId } = useCampaignFilter();
  const { data: incidents } = useData(() => listIncidents(), []);
  const { catalog } = useCatalog();
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("todas");
  const [busy, setBusy] = useState(false);

  const orders = useMemo(() => {
    let rows = (incidents ?? []).filter((i) => REPRO_TYPES.includes(i.type));
    if (campaignId) rows = rows.filter((i) => i.campaignId === campaignId);
    if (filter === "pendientes") rows = rows.filter((i) => ["abierta", "en_revision"].includes(i.status));
    if (filter === "en_curso") rows = rows.filter((i) => ["en_curso", "bloqueada"].includes(i.status));
    if (filter === "resueltas") rows = rows.filter((i) => ["resuelta", "cancelada"].includes(i.status));
    return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [incidents, filter, campaignId]);

  if (!can("incidents.view")) return <NoAccess />;
  const canManage = can("incidents.manage");

  const counts = {
    pendientes: (incidents ?? []).filter((i) => REPRO_TYPES.includes(i.type) && ["abierta", "en_revision"].includes(i.status)).length,
    produccion: (incidents ?? []).filter((i) => REPRO_TYPES.includes(i.type) && ["en_curso", "bloqueada"].includes(i.status)).length,
    enviadas: (incidents ?? []).filter((i) => REPRO_TYPES.includes(i.type) && i.status === "resuelta").length
  };

  async function advance(id: string, to: "en_curso" | "resuelta", note: string) {
    setBusy(true);
    try {
      await changeIncidentStatus(id, to, note, user?.id);
      refreshData();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Órdenes de Reproducción"
        subtitle="Gestión de piezas originadas por incidencias o errores de medición"
        actions={
          <a href="/incidencias" className="lg-btn lg-btn-primary">
            <Plus className="h-4 w-4" /> Nueva Reproducción
          </a>
        }
      />

      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => {
          const badge = value === "pendientes" ? counts.pendientes : value === "en_curso" ? counts.produccion : value === "resueltas" ? counts.enviadas : orders.length;
          return (
            <button
              key={value}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${filter === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              onClick={() => setFilter(value)}
            >
              {label} {value !== "todas" && `(${badge})`}
            </button>
          );
        })}
      </div>

      <Panel title={`Mostrando ${orders.length} reproducciones`}>
        {!orders.length ? (
          <Empty>
            <Copy className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            No hay órdenes de reproducción{filter !== "todas" ? " con este filtro" : ""}. Se generan desde las incidencias de material.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="lg-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Origen</th>
                  <th>Cliente / Campaña</th>
                  <th>Material / Pieza</th>
                  <th>Motivo</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  {canManage && <th>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((i) => {
                  const material = i.materialId ? catalog.materials.find((m) => m.id === i.materialId) : null;
                  return (
                    <tr key={i.id}>
                      <td className="font-bold text-blue-700">REP-{i.incidentCode.replace(/^INC-?/, "")}</td>
                      <td className="font-semibold text-blue-500">{i.incidentCode}</td>
                      <td>
                        <p className="font-medium">{catalog.clientName(i.clientId)}</p>
                        <p className="text-xs text-slate-400">{catalog.campaignName(i.campaignId)}</p>
                      </td>
                      <td>
                        <p className="text-sm font-medium">{material?.name ?? i.title}</p>
                        {material?.dimensions && <p className="text-[10px] text-slate-400">{material.dimensions}</p>}
                      </td>
                      <td><Chip tone="blue">{motivoLabel[i.type] ?? i.type}</Chip></td>
                      <td><PriorityChip priority={i.severity === "critica" ? "urgente" : i.severity === "alta" ? "alta" : i.severity === "baja" ? "baja" : "normal"} /></td>
                      <td><Chip tone={incidentStatusMeta[i.status].tone}>{incidentStatusMeta[i.status].label}</Chip></td>
                      {canManage && (
                        <td className="whitespace-nowrap">
                          {["abierta", "en_revision"].includes(i.status) && (
                            <button className="lg-btn lg-btn-outline lg-btn-sm" disabled={busy} onClick={() => advance(i.id, "en_curso", "Reproducción aprobada y en producción")}>
                              Aprobar
                            </button>
                          )}
                          {["en_curso", "bloqueada"].includes(i.status) && (
                            <button className="lg-btn lg-btn-blue lg-btn-sm" disabled={busy} onClick={() => advance(i.id, "resuelta", "Pieza reproducida y enviada")}>
                              Reproducida
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
