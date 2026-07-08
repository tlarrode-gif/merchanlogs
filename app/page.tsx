"use client";

import { getDashboardMetrics } from "@/services/dashboard.service";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { Badge, Card, EmptyState, PageHeader, StatCard, Table, Td } from "@/components/ui";
import { incidentSeverityMeta, incidentStatusMeta, movementTypeMeta } from "@/lib/status";
import { formatDateTime } from "@/lib/dates";

export default function DashboardPage() {
  const { data: metrics, loading } = useData(getDashboardMetrics, []);
  const { catalog } = useCatalog();

  if (loading || !metrics) return <p className="text-sm text-gray-400">Cargando dashboard...</p>;

  return (
    <div>
      <PageHeader
        title="Dashboard operativo"
        subtitle="Vision general de la operativa logistica (datos locales)."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Peticiones totales" value={metrics.requestsTotal} tone="blue" />
        <StatCard label="Pendientes" value={metrics.requestsPending} tone="amber" />
        <StatCard label="En preparacion" value={metrics.requestsPreparing} tone="purple" />
        <StatCard label="Enviadas" value={metrics.requestsShipped} tone="green" />
        <StatCard label="Incidencias abiertas" value={metrics.incidentsOpen} tone="red" />
        <StatCard label="Material pdte. entrada" value={metrics.materialPendingEntry} tone="amber" />
        <StatCard label="Material bajo stock" value={metrics.materialBelowStock} tone="red" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Ultimos movimientos</h2>
          {metrics.lastMovements.length === 0 ? (
            <EmptyState message="Sin movimientos registrados." />
          ) : (
            <Table headers={["Fecha", "Material", "Tipo", "Cantidad"]}>
              {metrics.lastMovements.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-gray-500">{formatDateTime(m.createdAt)}</Td>
                  <Td>{catalog.materialName(m.materialId)}</Td>
                  <Td>
                    <Badge tone={movementTypeMeta[m.type].tone}>{movementTypeMeta[m.type].label}</Badge>
                  </Td>
                  <Td>{m.quantity}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Ultimas incidencias</h2>
          {metrics.lastIncidents.length === 0 ? (
            <EmptyState message="Sin incidencias registradas." />
          ) : (
            <Table headers={["Codigo", "Titulo", "Severidad", "Estado"]}>
              {metrics.lastIncidents.map((i) => (
                <tr key={i.id}>
                  <Td className="whitespace-nowrap font-mono text-xs">{i.incidentCode}</Td>
                  <Td>{i.title}</Td>
                  <Td>
                    <Badge tone={incidentSeverityMeta[i.severity].tone}>{incidentSeverityMeta[i.severity].label}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={incidentStatusMeta[i.status].tone}>{incidentStatusMeta[i.status].label}</Badge>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
