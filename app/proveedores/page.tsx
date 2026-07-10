"use client";

/**
 * Proveedores (mockup image10): panel derivado de los datos reales de entradas
 * e incidencias. No existe todavia maestro de proveedores en el backend; esta
 * vista agrega por el campo "proveedor" de las entradas de material.
 */

import { useMemo } from "react";
import { Star, Timer, TriangleAlert } from "lucide-react";
import { getAdapter } from "@/services/adapter";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { Chip, Empty, Kpi, PageHeader, Panel } from "@/components/lg";
import { NoAccess } from "@/components/ui";
import { formatDate } from "@/lib/dates";

export default function ProveedoresPage() {
  const { can } = useSession();
  const { data } = useData(async () => {
    const adapter = getAdapter();
    const [entries, incidents, materials] = await Promise.all([
      adapter.list("stockEntries"),
      adapter.list("incidents"),
      adapter.list("materials")
    ]);
    return { entries, incidents, materials };
  }, []);
  const { catalog } = useCatalog();

  const suppliers = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; entries: typeof data.entries }>();
    data.entries.forEach((e) => {
      const name = (e.supplier || "").trim();
      if (!name) return;
      if (!map.has(name)) map.set(name, { name, entries: [] });
      map.get(name)!.entries.push(e);
    });
    return Array.from(map.values())
      .map((s) => {
        const materialIds = new Set(s.entries.map((e) => e.materialId));
        const enCurso = s.entries.filter((e) => e.status === "pendiente_revision").length;
        const conIncidencia = s.entries.filter((e) => e.status === "incidencia" || e.status === "rechazada").length;
        const incidents = data.incidents.filter((i) => i.stockEntryId && s.entries.some((e) => e.id === i.stockEntryId)).length + conIncidencia;
        const okRatio = s.entries.length ? 1 - conIncidencia / s.entries.length : 1;
        const rating = Math.max(1, Math.round(okRatio * 5));
        return { ...s, materials: materialIds.size, enCurso, incidents, rating, lastEntry: s.entries.map((e) => e.entryDate).sort().reverse()[0] };
      })
      .sort((a, b) => b.entries.length - a.entries.length);
  }, [data]);

  if (!can("entries.view")) return <NoAccess />;

  const worst = suppliers.slice().sort((a, b) => b.incidents - a.incidents)[0];
  const pendientes = suppliers.reduce((s, x) => s + x.enCurso, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Proveedores" subtitle="Rendimiento de producción y logística derivado de las entradas reales" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi
          label="Proveedor con más incidencias"
          value={worst && worst.incidents > 0 ? worst.name : "—"}
          tone={worst && worst.incidents > 0 ? "danger" : "default"}
          hint={worst && worst.incidents > 0 ? `${worst.incidents} incidencias registradas` : "Sin incidencias de proveedor"}
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <Kpi label="Entradas pendientes de recibir" value={pendientes} tone="blue" icon={<Timer className="h-4 w-4" />} />
        <Kpi label="Proveedores registrados" value={suppliers.length} hint="Detectados en las entradas de material" />
      </div>

      <Panel title={`Mostrando ${suppliers.length} proveedores`}>
        {!suppliers.length ? (
          <Empty>
            Sin proveedores todavía: se detectan automáticamente del campo &quot;proveedor&quot; de las Entradas.
            Registra una entrada de material con su proveedor para empezar.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="lg-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Materiales distintos</th>
                  <th>Entradas</th>
                  <th>En curso</th>
                  <th>Incidencias</th>
                  <th>Última entrada</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.name}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-white">
                          {s.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-semibold">{s.name}</span>
                      </span>
                    </td>
                    <td className="text-sm">{s.materials}</td>
                    <td className="text-sm font-semibold">{s.entries.length}</td>
                    <td>{s.enCurso ? <Chip tone="blue">{s.enCurso}</Chip> : <span className="text-xs text-slate-300">—</span>}</td>
                    <td>{s.incidents ? <Chip tone="red">{s.incidents}</Chip> : <span className="text-xs text-slate-300">0</span>}</td>
                    <td className="text-xs text-slate-500">{formatDate(s.lastEntry)}</td>
                    <td>
                      <span className="inline-flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-3.5 w-3.5 ${n <= s.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                        ))}
                        <span className="ml-1 text-[10px] text-slate-400">{s.rating}.0 / 5.0</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-xs text-slate-400">
        Próximamente: maestro de proveedores con SLA, homologación y asignación de materiales (requiere tabla propia en el backend compartido).
      </p>
    </div>
  );
}
