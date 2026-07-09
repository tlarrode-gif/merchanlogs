/**
 * Servicio de picking agrupado (PickingBatch).
 *
 * Un PickingBatch agrupa lineas (materiales agregados y/o piezas unitarias) segun
 * un criterio (por instalador, oficina, provincia, ruta, tipo...). Flujo:
 *
 *   crear  -> reserva stock (no descuenta) / marca piezas como reservadas
 *   preparar linea -> marca preparedQuantity (NO descuenta stock)
 *   incidencia linea -> marca faltante/incidencia (puede bloquear el cierre)
 *   cerrar -> DESCUENTA stock (movimiento `salida_picking`), libera reservas,
 *             marca piezas preparadas y deja el picking listo para envio
 *
 * El stock fisico SOLO se toca al cerrar. Ver services/stock.service.ts.
 */

import {
  Incident,
  Material,
  MaterialItem,
  PickingBatch,
  PickingBatchStatus,
  PickingLine,
  GroupingType,
  LogisticsRequest
} from "@/types";
import { getAdapter } from "@/services/adapter";
import { makeCrud } from "@/services/crud";
import { applyStockDelta, availableStock, reserveStock, releaseReservation } from "@/services/stock.service";
import { canTransition, pickingBatchStatusMeta } from "@/lib/status";
import { nextCode, uid } from "@/lib/ids";
import { nowIso } from "@/lib/dates";

const crud = makeCrud("pickingBatches", "pck");

export const listPickingBatches = () => crud.list();
export const getPickingBatch = (id: string) => crud.get(id);
export const removePickingBatch = (id: string) => crud.remove(id);

export async function nextPickingCode(): Promise<string> {
  const all = await crud.list();
  return nextCode("PCK", all.map((p) => p.pickingCode));
}

// ---------------------------------------------------------------------------
// Creacion
// ---------------------------------------------------------------------------

export interface CreateBatchInput {
  clientId: string;
  campaignId?: string | null;
  groupingType: GroupingType;
  assignedInstaller?: string | null;
  province?: string | null;
  route?: string | null;
  wave?: string | null;
  priority?: PickingBatch["priority"];
  logisticsRequestId?: string | null;
  importBatchId?: string | null;
  notes?: string | null;
}

/**
 * Crea un PickingBatch con sus lineas. Reserva stock de los materiales agregados
 * y marca las piezas unitarias como `reservado`. NO descuenta stock.
 */
async function createBatch(
  input: CreateBatchInput,
  lines: PickingLine[],
  actorId?: string | null
): Promise<PickingBatch> {
  const pickingCode = await nextPickingCode();
  const batch = await crud.create(
    {
      pickingCode,
      clientId: input.clientId,
      campaignId: input.campaignId ?? null,
      logisticsRequestId: input.logisticsRequestId ?? null,
      importBatchId: input.importBatchId ?? null,
      groupingType: input.groupingType,
      assignedInstaller: input.assignedInstaller ?? null,
      province: input.province ?? null,
      route: input.route ?? null,
      wave: input.wave ?? null,
      status: "pendiente_preparacion",
      priority: input.priority ?? "normal",
      assignedTo: null,
      closedAt: null,
      notes: input.notes ?? null,
      lines
    },
    actorId
  );

  // Reservas: por material agregado (sumando cantidades) y por pieza unitaria.
  const reservedByMaterial = new Map<string, number>();
  const adapter = getAdapter();
  for (const line of lines) {
    if (line.materialId) {
      reservedByMaterial.set(line.materialId, (reservedByMaterial.get(line.materialId) ?? 0) + line.quantity);
    }
    if (line.materialItemId) {
      await adapter.update("materialItems", line.materialItemId, {
        status: "reservado",
        pickingBatchId: batch.id,
        pickingLineId: line.id,
        updatedAt: nowIso(),
        updatedBy: actorId ?? null
      });
    }
  }
  for (const [materialId, qty] of Array.from(reservedByMaterial.entries())) {
    await reserveStock(materialId, qty, batch.id, actorId);
  }

  return batch;
}

function lineFromItem(item: MaterialItem): PickingLine {
  return {
    id: uid("pl"),
    materialId: item.materialId ?? null,
    materialItemId: item.id,
    description: item.name || item.itemCode,
    quantity: 1,
    preparedQuantity: 0,
    status: "pendiente",
    pointOfSaleName: item.pointOfSaleName ?? null,
    officeName: item.pointOfSaleName ?? null,
    officeCode: item.officeCode ?? null,
    address: item.address ?? null,
    city: item.city ?? null,
    province: item.province ?? null,
    installer: item.installer ?? null,
    route: item.route ?? null,
    materialType: item.type ?? null,
    dimensions: item.widthCm && item.heightCm ? `${item.widthCm}x${item.heightCm} cm` : null,
    location: item.location ?? null,
    serviceCode: item.serviceCode ?? null,
    incidentId: null,
    notes: item.notes ?? null
  };
}

export interface ItemFilter {
  installer?: string | null;
  province?: string | null;
  route?: string | null;
  pointOfSaleName?: string | null;
  materialType?: string | null;
}

/** Piezas unitarias disponibles (recibidas y sin picking asignado) que cumplen el filtro. */
export async function findAvailableItems(
  clientId: string,
  campaignId: string | null | undefined,
  filter: ItemFilter
): Promise<MaterialItem[]> {
  const items = await getAdapter().list("materialItems");
  return items.filter((it) => {
    if (it.clientId !== clientId) return false;
    if (campaignId && it.campaignId !== campaignId) return false;
    if (it.status !== "recibido") return false;
    if (it.pickingBatchId) return false;
    if (filter.installer && it.installer !== filter.installer) return false;
    if (filter.province && it.province !== filter.province) return false;
    if (filter.route && it.route !== filter.route) return false;
    if (filter.pointOfSaleName && it.pointOfSaleName !== filter.pointOfSaleName) return false;
    if (filter.materialType && it.type !== filter.materialType) return false;
    return true;
  });
}

/** Crea un picking a partir de piezas unitarias (ISDIN, Banc Sabadell). */
export async function createPickingFromItems(
  input: CreateBatchInput,
  filter: ItemFilter,
  actorId?: string | null
): Promise<PickingBatch> {
  const items = await findAvailableItems(input.clientId, input.campaignId, filter);
  if (items.length === 0) throw new Error("No hay piezas disponibles que cumplan el criterio seleccionado");
  const lines = items.map(lineFromItem);
  return createBatch(input, lines, actorId);
}

/** Crea un picking a partir de las lineas de una peticion logistica (material agregado). */
export async function createPickingFromRequest(
  request: LogisticsRequest,
  groupingType: GroupingType,
  actorId?: string | null
): Promise<PickingBatch> {
  const adapter = getAdapter();
  const materials = await adapter.list("materials");
  const byId = new Map<string, Material>(materials.map((m) => [m.id, m]));
  const lines: PickingLine[] = request.materials.map((l) => {
    const m = byId.get(l.materialId);
    return {
      id: uid("pl"),
      materialId: l.materialId,
      materialItemId: null,
      description: m?.name ?? "(material)",
      quantity: l.quantity,
      preparedQuantity: 0,
      status: "pendiente",
      pointOfSaleName: request.destination ?? null,
      officeName: null,
      officeCode: null,
      address: null,
      city: null,
      province: null,
      installer: null,
      route: null,
      materialType: m?.type ?? null,
      dimensions: m?.dimensions ?? null,
      location: m?.location ?? null,
      serviceCode: null,
      incidentId: null,
      notes: l.notes ?? null
    };
  });
  if (lines.length === 0) throw new Error("La peticion no tiene materiales");
  return createBatch(
    {
      clientId: request.clientId,
      campaignId: request.campaignId,
      groupingType,
      priority: request.priority,
      logisticsRequestId: request.id
    },
    lines,
    actorId
  );
}

// ---------------------------------------------------------------------------
// Cobertura de stock
// ---------------------------------------------------------------------------

export interface CoverageLine {
  line: PickingLine;
  available: number;
  covered: boolean;
}

/** Comprueba si hay stock disponible para las lineas de material agregado. */
export async function getStockCoverage(batch: PickingBatch): Promise<CoverageLine[]> {
  const materials = await getAdapter().list("materials");
  const byId = new Map<string, Material>(materials.map((m) => [m.id, m]));

  // Cuanto ha reservado ESTE batch por material (para no contarlo contra si mismo).
  const ownReservedByMaterial = new Map<string, number>();
  for (const line of batch.lines) {
    if (line.materialId) {
      ownReservedByMaterial.set(
        line.materialId,
        (ownReservedByMaterial.get(line.materialId) ?? 0) + line.quantity
      );
    }
  }

  return batch.lines.map((line) => {
    if (!line.materialId) return { line, available: 1, covered: true };
    const m = byId.get(line.materialId);
    // Disponible para este batch = fisico - reservado por OTROS batches.
    // (fisico - reservado total) + lo que este batch ya tiene reservado.
    const own = ownReservedByMaterial.get(line.materialId) ?? 0;
    const available = m ? availableStock(m) + own : 0;
    return { line, available, covered: available >= line.quantity };
  });
}

// ---------------------------------------------------------------------------
// Preparacion (sin descontar stock)
// ---------------------------------------------------------------------------

async function updateLines(batchId: string, mutate: (line: PickingLine) => PickingLine, actorId?: string | null) {
  const batch = await getRequired(batchId);
  const lines = batch.lines.map(mutate);
  const status = deriveBatchStatus(batch.status, lines);
  return crud.update(batchId, { lines, status }, actorId);
}

async function getRequired(batchId: string): Promise<PickingBatch> {
  const batch = await getAdapter().get("pickingBatches", batchId);
  if (!batch) throw new Error("Picking no encontrado");
  return batch;
}

/** Marca una linea como preparada (cantidad opcional; por defecto la total). NO descuenta stock. */
export async function prepareLine(
  batchId: string,
  lineId: string,
  quantity?: number,
  actorId?: string | null
): Promise<PickingBatch> {
  return updateLines(
    batchId,
    (line) => {
      if (line.id !== lineId) return line;
      const prepared = quantity == null ? line.quantity : Math.min(line.quantity, Math.max(0, quantity));
      const status: PickingLine["status"] = prepared >= line.quantity ? "preparado" : prepared > 0 ? "parcial" : "pendiente";
      return { ...line, preparedQuantity: prepared, status };
    },
    actorId
  );
}

/** Marca una linea con incidencia/faltante y opcionalmente la vincula a una incidencia. */
export async function flagLine(
  batchId: string,
  lineId: string,
  status: "incidencia" | "faltante",
  incidentId?: string | null,
  actorId?: string | null
): Promise<PickingBatch> {
  return updateLines(
    batchId,
    (line) => (line.id === lineId ? { ...line, status, incidentId: incidentId ?? line.incidentId ?? null } : line),
    actorId
  );
}

/**
 * Cancela una linea del picking: no se preparara ni se enviara. No toca el stock
 * fisico; su reserva se libera al cerrar el batch (la logica de cierre libera la
 * reserva completa y solo consume lo preparado, que aqui queda a 0). Las piezas
 * unitarias no preparadas se liberan tambien en el cierre.
 */
export async function cancelLine(
  batchId: string,
  lineId: string,
  actorId?: string | null
): Promise<PickingBatch> {
  return updateLines(
    batchId,
    (line) => (line.id === lineId ? { ...line, status: "cancelada", preparedQuantity: 0 } : line),
    actorId
  );
}

/** Cambia el estado del batch validando la transicion (cambios manuales). */
export async function changeBatchStatus(
  batchId: string,
  to: PickingBatchStatus,
  actorId?: string | null
): Promise<PickingBatch> {
  const batch = await getRequired(batchId);
  if (!canTransition(pickingBatchStatusMeta, batch.status, to)) {
    throw new Error(`Transicion no permitida: ${pickingBatchStatusMeta[batch.status].label} -> ${pickingBatchStatusMeta[to].label}`);
  }
  return crud.update(batchId, { status: to }, actorId);
}

/** Deriva el estado del batch a partir del estado de sus lineas. */
function deriveBatchStatus(current: PickingBatchStatus, lines: PickingLine[]): PickingBatchStatus {
  // No re-derivar estados terminales ni de envio.
  if (["listo_para_envio", "enviado", "cerrado", "cancelado"].includes(current)) return current;
  if (lines.length === 0) return current;
  const anyIncident = lines.some((l) => l.status === "incidencia" || l.status === "faltante");
  const allPrepared = lines.every((l) => l.status === "preparado" || l.status === "cancelada");
  const anyProgress = lines.some((l) => l.preparedQuantity > 0 || l.status !== "pendiente");
  if (anyIncident) return "con_incidencia";
  if (allPrepared) return "preparado_completo";
  if (anyProgress) return "en_preparacion";
  return "pendiente_preparacion";
}

// ---------------------------------------------------------------------------
// Cierre (DESCUENTA stock)
// ---------------------------------------------------------------------------

export interface CloseResult {
  batch: PickingBatch;
  consumedUnits: number;
  partial: boolean;
}

/**
 * Cierra el picking: descuenta el stock realmente preparado (movimiento
 * `salida_picking`), libera reservas, marca piezas unitarias preparadas y deja
 * el batch como `listo_para_envio`. Idempotente por `closedAt`.
 */
export async function closePickingBatch(batchId: string, actorId?: string | null): Promise<CloseResult> {
  const adapter = getAdapter();
  const batch = await getRequired(batchId);
  if (batch.closedAt) throw new Error("El picking ya esta cerrado (stock ya descontado)");

  // Bloqueo por incidencias que bloquean el cierre.
  const incidents = await adapter.list("incidents");
  const blocking = incidents.filter(
    (i: Incident) => i.pickingBatchId === batchId && i.blocksPicking && i.status !== "resuelta" && i.status !== "cancelada"
  );
  if (blocking.length > 0) {
    throw new Error(`No se puede cerrar: hay ${blocking.length} incidencia(s) que bloquean el picking`);
  }

  let consumedUnits = 0;
  let partial = false;

  // Agrupar cantidad preparada y reservada por material agregado.
  const preparedByMaterial = new Map<string, number>();
  const reservedByMaterial = new Map<string, number>();
  for (const line of batch.lines) {
    if (line.materialId) {
      preparedByMaterial.set(line.materialId, (preparedByMaterial.get(line.materialId) ?? 0) + line.preparedQuantity);
      reservedByMaterial.set(line.materialId, (reservedByMaterial.get(line.materialId) ?? 0) + line.quantity);
    }
    if (line.preparedQuantity < line.quantity) partial = true;
  }

  // Consumir stock agregado preparado + liberar toda la reserva del batch.
  for (const [materialId, reserved] of Array.from(reservedByMaterial.entries())) {
    const prepared = preparedByMaterial.get(materialId) ?? 0;
    await releaseReservation(materialId, reserved, batch.id, actorId);
    if (prepared > 0) {
      await applyStockDelta({
        materialId,
        delta: -prepared,
        type: "salida_picking",
        reason: `Cierre de picking ${batch.pickingCode}`,
        fromLocation: "almacen",
        relatedEntityType: "picking_batch",
        relatedEntityId: batch.id,
        actorId
      });
      consumedUnits += prepared;
    }
  }

  // Piezas unitarias: las preparadas salen (movimiento salida_picking qty 1).
  for (const line of batch.lines) {
    if (!line.materialItemId) continue;
    if (line.status === "preparado") {
      await adapter.update("materialItems", line.materialItemId, {
        status: "preparado",
        updatedAt: nowIso(),
        updatedBy: actorId ?? null
      });
      await applyMovementForItem(line.materialItemId, batch, actorId);
      consumedUnits += 1;
    } else {
      // Pieza no preparada: se libera del picking para poder re-planificarla.
      await adapter.update("materialItems", line.materialItemId, {
        status: "recibido",
        pickingBatchId: null,
        pickingLineId: null,
        updatedAt: nowIso(),
        updatedBy: actorId ?? null
      });
    }
  }

  const closed = await crud.update(
    batchId,
    { status: "listo_para_envio", closedAt: nowIso() },
    actorId
  );
  return { batch: closed, consumedUnits, partial };
}

async function applyMovementForItem(materialItemId: string, batch: PickingBatch, actorId?: string | null) {
  const { recordMovement } = await import("@/services/stock.service");
  const item = await getAdapter().get("materialItems", materialItemId);
  await recordMovement({
    materialId: item?.materialId ?? null,
    materialItemId,
    clientId: batch.clientId,
    campaignId: batch.campaignId,
    type: "salida_picking",
    quantity: 1,
    reason: `Cierre de picking ${batch.pickingCode} (pieza ${item?.itemCode ?? materialItemId})`,
    relatedEntityType: "picking_line",
    relatedEntityId: batch.id,
    actorId
  });
}

// ---------------------------------------------------------------------------
// Resumen para hoja de picking / listados
// ---------------------------------------------------------------------------

export interface BatchSummary {
  totalLines: number;
  totalUnits: number;
  totalPrepared: number;
  totalPoints: number;
  openIncidents: number;
}

export function summarizeBatch(batch: PickingBatch, incidents: Incident[]): BatchSummary {
  const points = new Set(batch.lines.map((l) => l.officeName || l.pointOfSaleName || l.officeCode || "-"));
  return {
    totalLines: batch.lines.length,
    totalUnits: batch.lines.reduce((acc, l) => acc + l.quantity, 0),
    totalPrepared: batch.lines.reduce((acc, l) => acc + l.preparedQuantity, 0),
    totalPoints: points.size,
    openIncidents: incidents.filter(
      (i) => i.pickingBatchId === batch.id && i.status !== "resuelta" && i.status !== "cancelada"
    ).length
  };
}

/** Agrupa las lineas de un batch segun un criterio para la hoja de picking. */
export function groupLines(batch: PickingBatch): { key: string; lines: PickingLine[] }[] {
  const keyOf = (l: PickingLine): string => {
    switch (batch.groupingType) {
      case "por_instalador":
        return l.installer || "Sin instalador";
      case "por_oficina":
      case "por_punto_venta":
        return l.officeName || l.pointOfSaleName || "Sin destino";
      case "por_provincia":
        return l.province || "Sin provincia";
      case "por_ruta":
        return l.route || "Sin ruta";
      case "por_tipo_material":
        return l.materialType || "Sin tipo";
      default:
        return l.officeName || l.pointOfSaleName || "General";
    }
  };
  const groups = new Map<string, PickingLine[]>();
  for (const line of batch.lines) {
    const key = keyOf(line);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(line);
  }
  return Array.from(groups.entries())
    .map(([key, lines]) => ({ key, lines }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
