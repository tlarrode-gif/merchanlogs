"use client";

/**
 * Dashboard del rediseño (mockup image2): KPIs operativos, evolucion de
 * materiales por estado, alertas criticas, peticiones pendientes de OPS e
 * incidencias por tipo.
 */

import Link from "next/link";
import { useMemo } from "react";
import { CalendarClock, ClipboardList, Factory, PackageSearch, Send, TriangleAlert } from "lucide-react";
import { useData } from "@/components/use-data";
import { useCampaignFilter } from "@/app/app-shell";
import { Bars, Chip, Donut, Empty, Kpi, PageHeader, Panel, SeverityChip } from "@/components/lg";
import { getAdapter } from "@/services/adapter";
import { requestStatusMeta } from "@/lib/status";

const humanize = (value: string) => value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
import { formatDate } from "@/lib/dates";

const OPEN_REQUEST_STATUSES = ["solicitada", "en_revision", "pendiente_material", "preparando", "lista_para_envio"];

export default function DashboardPage() {
  const { campaignId } = useCampaignFilter();
  const { data, loading } = useData(async () => {
    const adapter = getAdapter();
    const [requests, pickings, shipments, incidents, materials, items, campaigns, clients] = await Promise.all([
      adapter.list("logisticsRequests"),
      adapter.list("pickingBatches"),
      adapter.list("shipments"),
      adapter.list("incidents"),
      adapter.list("materials"),
      adapter.list("materialItems"),
      adapter.list("campaigns"),
      adapter.list("clients")
    ]);
    return { requests, pickings, shipments, incidents, materials, items, campaigns, clients };
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const inCampaign = <T extends { campaignId?: string | null }>(rows: T[]) =>
      campaignId ? rows.filter((r) => r.campaignId === campaignId) : rows;

    const requests = inCampaign(data.requests);
    const pickings = inCampaign(data.pickings);
    const shipments = inCampaign(data.shipments);
    const incidents = inCampaign(data.incidents);

    const pendingRequests = requests
      .filter((r) => OPEN_REQUEST_STATUSES.includes(r.status))
      .sort((a, b) => (a.priority === "urgente" ? -1 : 1) - (b.priority === "urgente" ? -1 : 1));
    const urgentRequests = pendingRequests.filter((r) => r.priority === "urgente" || r.priority === "alta");
    const openIncidents = incidents.filter((i) => !["resuelta", "cancelada"].includes(i.status));
    const criticalAlerts = [
      ...urgentRequests.map((r) => ({
        id: `req-${r.id}`,
        level: (r.priority === "urgente" ? "critica" : "alta") as "critica" | "alta",
        title: r.requestCode,
        text: `Petición ${requestStatusMeta[r.status]?.label?.toLowerCase() ?? r.status}${r.neededByDate ? ` · necesaria ${formatDate(r.neededByDate)}` : ""}`,
        href: `/peticiones?id=${r.id}`
      })),
      ...openIncidents
        .filter((i) => i.severity === "critica" || i.severity === "alta")
        .map((i) => ({
          id: `inc-${i.id}`,
          level: i.severity as "critica" | "alta",
          title: i.incidentCode,
          text: i.title,
          href: `/incidencias?id=${i.id}`
        }))
    ].slice(0, 6);

    const itemStates: Array<{ label: string; value: number; soft?: boolean }> = [
      { label: "Pdte prod.", value: data.items.filter((i) => i.status === "pendiente_produccion").length, soft: true },
      { label: "Pdte recep.", value: data.items.filter((i) => i.status === "pendiente_recepcion").length, soft: true },
      { label: "Almacén", value: data.items.filter((i) => i.status === "recibido").length },
      { label: "Reservado", value: data.items.filter((i) => i.status === "reservado").length },
      { label: "Preparado", value: data.items.filter((i) => i.status === "preparado").length },
      { label: "Enviado", value: data.items.filter((i) => i.status === "enviado").length },
      { label: "Instalado", value: data.items.filter((i) => i.status === "instalado").length, soft: true }
    ];

    const incidentTypes = new Map<string, number>();
    openIncidents.forEach((i) => incidentTypes.set(i.type, (incidentTypes.get(i.type) ?? 0) + 1));
    const donutColors = ["#dc2626", "#f59e0b", "#3b82f6", "#0f172a", "#8b5cf6", "#10b981"];
    const incidentDonut = Array.from(incidentTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, value], idx) => ({
        label: humanize(type),
        value,
        color: donutColors[idx % donutColors.length]
      }));

    const pickingActive = pickings.filter((p) => ["pendiente_preparacion", "en_preparacion"].includes(p.status));
    const shipped = shipments.filter((s) => !["cancelado", "devuelto"].includes(s.status));
    const readyPct = pendingRequests.length + pickingActive.length === 0
      ? 100
      : Math.round(
          (pickings.filter((p) => ["preparado_completo", "listo_para_envio", "enviado", "cerrado"].includes(p.status)).length /
            Math.max(1, pickings.length)) * 100
        );

    return {
      requests,
      pendingRequests,
      urgentRequests,
      openIncidents,
      criticalAlerts,
      itemStates,
      incidentDonut,
      pickingActive,
      shipped,
      readyPct,
      campaignName: (id: string | null | undefined) => data.campaigns.find((c) => c.id === id)?.campaignName ?? "—",
      clientName: (id: string | null | undefined) => data.clients.find((c) => c.id === id)?.name ?? "—"
    };
  }, [data, campaignId]);

  if (loading || !view) return <p className="text-sm text-slate-400">Cargando dashboard...</p>;

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" subtitle="Gestión logística, materiales y trazabilidad operativa" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Peticiones pendientes" value={view.pendingRequests.length} icon={<Factory className="h-4 w-4" />} />
        <Kpi label="En preparación" value={view.pickingActive.length} icon={<ClipboardList className="h-4 w-4" />} />
        <Kpi
          label="En picking"
          value={view.pickingActive.reduce((s, p) => s + p.lines.length, 0)}
          icon={<PackageSearch className="h-4 w-4" />}
        />
        <Kpi label="Enviados" value={view.shipped.length} icon={<Send className="h-4 w-4" />} />
        <Kpi label="Incidencias abiertas" value={view.openIncidents.length} tone="danger" icon={<TriangleAlert className="h-4 w-4" />} />
        <Kpi label="% Ready to Execute" value={`${view.readyPct}%`} tone="blue" hint={<span className="text-green-600">progreso de picking</span>} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Panel title={<span className="inline-flex items-center gap-2">📊 Evolución de materiales por estado</span>}>
            {view.itemStates.every((s) => s.value === 0) ? (
              <Empty>Sin piezas registradas todavía. Los estados aparecerán al importar o recibir material.</Empty>
            ) : (
              <Bars data={view.itemStates} height={170} />
            )}
          </Panel>

          <Panel
            title={<span className="inline-flex items-center gap-2">🔒 Peticiones pendientes</span>}
            actions={<Link href="/peticiones" className="text-xs font-semibold text-blue-600 hover:underline">Ver todas</Link>}
          >
            {view.pendingRequests.length === 0 ? (
              <Empty>No hay peticiones pendientes. Las solicitudes de OPS aparecerán aquí.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="lg-table">
                  <thead>
                    <tr>
                      <th>Petición</th>
                      <th>Cliente / Campaña</th>
                      <th>Estado</th>
                      <th>Necesaria</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {view.pendingRequests.slice(0, 5).map((r) => (
                      <tr key={r.id}>
                        <td className="font-semibold text-blue-700">{r.requestCode}</td>
                        <td>
                          <p className="font-medium">{view.clientName(r.clientId)}</p>
                          <p className="text-xs text-slate-400">{view.campaignName(r.campaignId)}</p>
                        </td>
                        <td>
                          <Chip tone={requestStatusMeta[r.status]?.tone ?? "gray"}>{requestStatusMeta[r.status]?.label ?? r.status}</Chip>
                        </td>
                        <td className="text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {r.neededByDate ? formatDate(r.neededByDate) : "—"}
                          </span>
                        </td>
                        <td className="text-right">
                          <Link href={`/peticiones?id=${r.id}`} className="lg-btn lg-btn-primary lg-btn-sm">
                            Gestionar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title={<span className="inline-flex items-center gap-2">🔔 Alertas Críticas</span>}
            actions={view.criticalAlerts.length > 0 && <Chip tone="red">{view.criticalAlerts.length}</Chip>}
          >
            {view.criticalAlerts.length === 0 ? (
              <Empty>Sin alertas críticas. Todo bajo control.</Empty>
            ) : (
              <ul className="space-y-3">
                {view.criticalAlerts.map((a) => (
                  <li key={a.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <SeverityChip level={a.level} />
                      <span className="text-sm font-bold">{a.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{a.text}</p>
                    <Link href={a.href} className="text-[11px] font-semibold text-blue-600 hover:underline">
                      [Detalle]
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={<span className="inline-flex items-center gap-2">🧭 Incidencias por tipo</span>}>
            {view.incidentDonut.length === 0 ? (
              <Empty>Sin incidencias abiertas.</Empty>
            ) : (
              <Donut data={view.incidentDonut} centerLabel={String(view.openIncidents.length)} />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
