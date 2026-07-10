"use client";

/**
 * Power BI / Insights (mockup image11): analisis calculado sobre los datos
 * reales — estado de servicios/peticiones, tiempos medios, incidencias por
 * tipo y rendimiento por campaña, con conclusiones automaticas.
 */

import { useMemo } from "react";
import { Lightbulb, Timer, TrendingUp } from "lucide-react";
import { getAdapter } from "@/services/adapter";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { Bars, Chip, Donut, Empty, Kpi, PageHeader, Panel, Progress } from "@/components/lg";
import { NoAccess } from "@/components/ui";

const humanize = (v: string) => v.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

export default function InsightsPage() {
  const { can } = useSession();
  const { data } = useData(async () => {
    const adapter = getAdapter();
    const [requests, pickings, shipments, incidents, movements, campaigns] = await Promise.all([
      adapter.list("logisticsRequests"),
      adapter.list("pickingBatches"),
      adapter.list("shipments"),
      adapter.list("incidents"),
      adapter.list("stockMovements"),
      adapter.list("campaigns")
    ]);
    return { requests, pickings, shipments, incidents, movements, campaigns };
  }, []);
  const { catalog } = useCatalog();

  const view = useMemo(() => {
    if (!data) return null;
    const { requests, incidents, shipments } = data;

    const statusDonut = [
      { label: "En proceso", value: requests.filter((r) => ["preparando", "lista_para_envio", "en_revision", "solicitada"].includes(r.status)), color: "#3b82f6" },
      { label: "Bloqueados", value: requests.filter((r) => ["pendiente_material", "incidencia"].includes(r.status)), color: "#dc2626" },
      { label: "Completados", value: requests.filter((r) => ["enviada", "entregada"].includes(r.status)), color: "#16a34a" },
      { label: "Otros", value: requests.filter((r) => ["borrador", "cancelada"].includes(r.status)), color: "#94a3b8" }
    ].map((d) => ({ ...d, value: d.value.length }));
    const blockedPct = requests.length
      ? Math.round((requests.filter((r) => ["pendiente_material", "incidencia"].includes(r.status)).length / requests.length) * 100)
      : 0;

    // Tiempo medio peticion → envio (dias) sobre peticiones enviadas/entregadas.
    const times: number[] = [];
    requests
      .filter((r) => ["enviada", "entregada"].includes(r.status))
      .forEach((r) => {
        const shipment = shipments.find((s) => s.logisticsRequestId === r.id);
        const end = shipment?.shippingDate || shipment?.createdAt || r.updatedAt;
        if (r.requestedDate && end) {
          const days = (new Date(end).getTime() - new Date(r.requestedDate).getTime()) / 86400000;
          if (days >= 0 && days < 120) times.push(days);
        }
      });
    const avgDays = times.length ? Math.round((times.reduce((s, x) => s + x, 0) / times.length) * 10) / 10 : null;

    const incidentTypes = new Map<string, number>();
    incidents.forEach((i) => incidentTypes.set(i.type, (incidentTypes.get(i.type) ?? 0) + 1));
    const incidentBars = Array.from(incidentTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, value]) => ({ label: humanize(type).slice(0, 12), value }));

    const perCampaign = data.campaigns
      .map((c) => {
        const reqs = requests.filter((r) => r.campaignId === c.id);
        const total = reqs.reduce((s, r) => s + r.materials.reduce((x, l) => x + l.quantity, 0), 0);
        const prepared = reqs.reduce((s, r) => s + r.materials.reduce((x, l) => x + Math.min(l.preparedQuantity, l.quantity), 0), 0);
        return { campaign: c, requests: reqs.length, volume: total, pct: total ? Math.round((prepared / total) * 100) : 0 };
      })
      .filter((r) => r.requests > 0)
      .sort((a, b) => b.volume - a.volume);

    // Conclusiones automaticas sencillas sobre datos reales.
    const conclusions: string[] = [];
    const topIncident = incidentBars[0];
    if (topIncident && incidents.length >= 3) {
      conclusions.push(
        `El ${Math.round((topIncident.value / incidents.length) * 100)}% de las incidencias son de tipo "${topIncident.label}". Refuerza la validación en ese punto del proceso.`
      );
    }
    if (blockedPct > 15) {
      conclusions.push(`Un ${blockedPct}% de las peticiones están bloqueadas por falta de material: revisa stock mínimo y entradas pendientes.`);
    }
    if (avgDays != null) {
      conclusions.push(`El tiempo medio de petición a envío es de ${avgDays} días${avgDays > 7 ? ": hay margen de mejora agrupando pickings por zona" : ", dentro de objetivo"}.`);
    }
    if (!conclusions.length) conclusions.push("Aún hay pocos datos para extraer conclusiones. Los insights mejorarán con el uso.");

    return { statusDonut, blockedPct, avgDays, incidentBars, perCampaign, conclusions, totalRequests: requests.length };
  }, [data]);

  if (!can("requests.view")) return <NoAccess />;
  if (!view) return <p className="text-sm text-slate-400">Calculando insights...</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Análisis Predictivo"
        subtitle="Visión integrada de operaciones logísticas con datos reales en tiempo real"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="Peticiones analizadas" value={view.totalRequests} icon={<TrendingUp className="h-4 w-4" />} />
        <Kpi
          label="Tiempo medio petición → envío"
          value={view.avgDays != null ? `${view.avgDays} días` : "—"}
          tone="blue"
          hint={view.avgDays == null ? "Aún sin envíos completados" : undefined}
          icon={<Timer className="h-4 w-4" />}
        />
        <Kpi label="% peticiones bloqueadas" value={`${view.blockedPct}%`} tone={view.blockedPct > 15 ? "danger" : "ok"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Estado de peticiones">
          {view.totalRequests === 0 ? <Empty>Sin peticiones registradas.</Empty> : <Donut data={view.statusDonut} centerLabel={`${view.blockedPct}%`} />}
        </Panel>
        <Panel title="Incidencias por tipo">
          {!view.incidentBars.length ? <Empty>Sin incidencias registradas.</Empty> : <Bars data={view.incidentBars} height={160} />}
        </Panel>
      </div>

      <Panel title={<span className="inline-flex items-center gap-2"><Lightbulb className="h-4 w-4 text-blue-600" /> Conclusiones</span>}>
        <div className="grid gap-3 md:grid-cols-3">
          {view.conclusions.map((c, i) => (
            <div key={i} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs leading-relaxed text-slate-700">
              {c}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Rendimiento por campaña activa">
        {!view.perCampaign.length ? (
          <Empty>Sin campañas con peticiones todavía.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="lg-table">
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>Peticiones</th>
                  <th>Volumen (uds)</th>
                  <th>Progreso</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {view.perCampaign.map((r) => (
                  <tr key={r.campaign.id}>
                    <td className="font-semibold">{r.campaign.campaignName}</td>
                    <td className="text-sm">{r.requests}</td>
                    <td className="text-sm font-semibold">{r.volume.toLocaleString("es-ES")} uds</td>
                    <td className="min-w-[160px]">
                      <p className="mb-1 text-[10px] font-bold text-slate-500">{r.pct}%</p>
                      <Progress value={r.pct} tone={r.pct === 100 ? "green" : "blue"} />
                    </td>
                    <td><Chip tone={r.pct === 100 ? "green" : r.pct > 0 ? "blue" : "gray"}>{r.pct === 100 ? "COMPLETADA" : r.pct > 0 ? "EN PREPARACIÓN" : "PENDIENTE"}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
