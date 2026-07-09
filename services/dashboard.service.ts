/**
 * Servicio de metricas del dashboard operativo. Agrega datos de varias
 * colecciones en un unico objeto de KPIs para la pantalla principal.
 */

import { Incident, Material, StockMovement } from "@/types";
import { getAdapter } from "@/services/adapter";
import { isBelowMinimum } from "@/services/stock.service";
import { activePickingStatuses, openIncidentStatuses } from "@/lib/status";

export interface DashboardMetrics {
  requestsTotal: number;
  requestsPending: number;
  requestsPreparing: number;
  requestsShipped: number;
  incidentsOpen: number;
  materialPendingEntry: number;
  materialBelowStock: number;
  pickingActive: number;
  itemsInStock: number;
  lastMovements: StockMovement[];
  lastIncidents: Incident[];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const adapter = getAdapter();
  const [requests, incidents, materials, movements, pickingBatches, items] = await Promise.all([
    adapter.list("logisticsRequests"),
    adapter.list("incidents"),
    adapter.list("materials"),
    adapter.list("stockMovements"),
    adapter.list("pickingBatches"),
    adapter.list("materialItems")
  ]);

  const pendingStatuses = ["borrador", "solicitada", "en_revision"];
  const preparingStatuses = ["preparando", "pendiente_material", "lista_para_envio"];

  const lastMovements = [...movements]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  const lastIncidents = [...incidents]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return {
    requestsTotal: requests.length,
    requestsPending: requests.filter((r) => pendingStatuses.includes(r.status)).length,
    requestsPreparing: requests.filter((r) => preparingStatuses.includes(r.status)).length,
    requestsShipped: requests.filter((r) => ["enviada", "entregada"].includes(r.status)).length,
    incidentsOpen: incidents.filter((i) => openIncidentStatuses.includes(i.status)).length,
    materialPendingEntry: materials.filter((m: Material) =>
      ["pendiente_produccion", "pendiente_recepcion"].includes(m.status)
    ).length,
    materialBelowStock: materials.filter((m: Material) => isBelowMinimum(m)).length,
    pickingActive: pickingBatches.filter((p) => activePickingStatuses.includes(p.status)).length,
    itemsInStock: items.filter((it) => it.status === "recibido").length,
    lastMovements,
    lastIncidents
  };
}
