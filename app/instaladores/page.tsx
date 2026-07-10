"use client";

/**
 * Instaladores (mockup image9): estado de "readiness" por instalador calculado
 * de los pickings y envios reales — un instalador esta Ready to Execute cuando
 * todo su material esta preparado/enviado y sin incidencias abiertas.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, PackageX, Users } from "lucide-react";
import { getAdapter } from "@/services/adapter";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { useCampaignFilter } from "@/app/app-shell";
import { Chip, Empty, Kpi, PageHeader, Panel } from "@/components/lg";
import { NoAccess } from "@/components/ui";
import { pickingBatchStatusMeta, shipmentStatusMeta } from "@/lib/status";

type Readiness = "ready" | "missing" | "incidencia";

const readinessMeta: Record<Readiness, { label: string; tone: string }> = {
  ready: { label: "Ready to Execute", tone: "green" },
  missing: { label: "Missing Requirements", tone: "amber" },
  incidencia: { label: "Incidencia", tone: "red" }
};

export default function InstaladoresPage() {
  const { can } = useSession();
  const { campaignId } = useCampaignFilter();
  const { data } = useData(async () => {
    const adapter = getAdapter();
    const [pickings, shipments, incidents, items] = await Promise.all([
      adapter.list("pickingBatches"),
      adapter.list("shipments"),
      adapter.list("incidents"),
      adapter.list("materialItems")
    ]);
    return { pickings, shipments, incidents, items };
  }, []);
  const { catalog } = useCatalog();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const installers = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; pickings: typeof data.pickings; items: typeof data.items }>();
    const add = (name: string | null | undefined) => {
      const key = (name || "").trim();
      if (!key) return null;
      if (!map.has(key)) map.set(key, { name: key, pickings: [], items: [] });
      return map.get(key)!;
    };
    data.pickings
      .filter((p) => !campaignId || p.campaignId === campaignId)
      .forEach((p) => {
        const bucket = add(p.assignedInstaller);
        if (bucket) bucket.pickings.push(p);
        p.lines.forEach((l) => {
          const lineBucket = add(l.installer);
          if (lineBucket && !lineBucket.pickings.includes(p)) lineBucket.pickings.push(p);
        });
      });
    data.items.forEach((i) => {
      const bucket = add(i.installer);
      if (bucket) bucket.items.push(i);
    });

    return Array.from(map.values())
      .map((entry) => {
        const active = entry.pickings.filter((p) => !["cerrado", "enviado", "cancelado"].includes(p.status));
        const hasIncident = entry.pickings.some((p) =>
          data.incidents.some((i) => i.pickingBatchId === p.id && !["resuelta", "cancelada"].includes(i.status))
        );
        const pendingLines = active.flatMap((p) => p.lines.filter((l) => !["preparado", "cancelada"].includes(l.status)));
        const readiness: Readiness = hasIncident ? "incidencia" : pendingLines.length ? "missing" : "ready";
        return { ...entry, active, pendingLines, readiness };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, campaignId]);

  const selected = installers.find((i) => i.name === selectedName) ?? installers[0] ?? null;

  if (!can("picking.view")) return <NoAccess />;

  const kpis = {
    total: installers.length,
    ready: installers.filter((i) => i.readiness === "ready").length,
    missing: installers.filter((i) => i.readiness !== "ready").length
  };
  const readyPct = kpis.total ? Math.round((kpis.ready / kpis.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Gestión de Instaladores" subtitle="Readiness operativo calculado del picking y los envíos" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="Instaladores con actividad" value={kpis.total} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Ready to Execute" value={kpis.ready} tone="ok" hint={`${readyPct}% de la fuerza operativa lista`} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Kpi label="Pendientes de material" value={kpis.missing} tone={kpis.missing ? "danger" : "default"} icon={<PackageX className="h-4 w-4" />} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title="Estado de Readiness">
          {!installers.length ? (
            <Empty>Sin instaladores con material asignado todavía. Aparecerán al asignar pickings o piezas.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="lg-table">
                <thead>
                  <tr>
                    <th>Instalador</th>
                    <th>Pickings activos</th>
                    <th>Líneas pendientes</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {installers.map((i) => (
                    <tr key={i.name} className={`cursor-pointer ${selected?.name === i.name ? "lg-row-active" : ""}`} onClick={() => setSelectedName(i.name)}>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                            {i.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                          <span className="font-semibold">{i.name}</span>
                        </span>
                      </td>
                      <td className="text-sm font-semibold">{i.active.length}</td>
                      <td className="text-sm">{i.pendingLines.length || "—"}</td>
                      <td><Chip tone={readinessMeta[i.readiness].tone}>{readinessMeta[i.readiness].label}</Chip></td>
                      <td><ChevronRight className="h-4 w-4 text-blue-500" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {selected && (
          <Panel title={selected.name} actions={<Chip tone={readinessMeta[selected.readiness].tone}>{readinessMeta[selected.readiness].label}</Chip>} className="xl:sticky xl:top-16">
            <div className="space-y-4">
              <div>
                <p className="lg-kpi-label mb-2">Pickings asignados ({selected.pickings.length})</p>
                {!selected.pickings.length ? (
                  <Empty>Sin pickings.</Empty>
                ) : (
                  <ul className="space-y-2">
                    {selected.pickings.slice(0, 6).map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-2.5">
                        <div className="min-w-0">
                          <Link href={`/picking?id=${p.id}`} className="text-sm font-bold text-blue-700 hover:underline">{p.pickingCode}</Link>
                          <p className="text-[11px] text-slate-400">{catalog.campaignName(p.campaignId)}</p>
                        </div>
                        <Chip tone={pickingBatchStatusMeta[p.status].tone}>{pickingBatchStatusMeta[p.status].label}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="lg-kpi-label mb-2">Pendiente de material</p>
                {!selected.pendingLines.length ? (
                  <p className="text-xs text-emerald-600">✓ Todo el material preparado.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selected.pendingLines.slice(0, 6).map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                        <span className="min-w-0 truncate font-medium">{l.description}</span>
                        <Chip tone={l.status === "faltante" ? "red" : "amber"}>{l.status.replaceAll("_", " ").toUpperCase()}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {data && (
                <div>
                  <p className="lg-kpi-label mb-2">Envíos relacionados</p>
                  {(() => {
                    const related = data.shipments.filter((s) => (s.destination || "").trim() === selected.name);
                    return !related.length ? (
                      <p className="text-xs text-slate-400">Sin envíos a su nombre.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {related.slice(0, 4).map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                            <Link href={`/envios?id=${s.id}`} className="font-semibold text-blue-700 hover:underline">{s.shipmentCode}</Link>
                            <Chip tone={shipmentStatusMeta[s.status].tone}>{shipmentStatusMeta[s.status].label}</Chip>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
