/**
 * Adaptador Supabase (fase 3a: SOLO LECTURA).
 *
 * Conecta MerchanLOGS al proyecto Supabase compartido con MerchanOPS y mapea
 * las tablas reales `logistics_*` (y los maestros de OPS) al dominio de LOGS.
 * El mapeo campo a campo y de estados esta documentado en
 * docs/SUPABASE_RECONCILIATION.md — este fichero es su implementacion.
 *
 * Reglas de esta fase:
 * - `list`/`get` leen de Supabase con mapeadores por coleccion (joins de
 *   stock, lineas de picking/peticion/entrada incluidos).
 * - `insert`/`update`/`remove` lanzan error explicativo (la escritura llega
 *   en fase 3b, entidad a entidad).
 * - `reset()` esta BLOQUEADO: la base compartida jamas se re-siembra desde LOGS.
 * - `requestHistory` e `importBatches` no tienen tabla: siguen en el adaptador
 *   local para que la app funcione completa en modo mixto.
 */

import {
  CollectionName,
  CollectionTypeMap,
  LogisticsRequestStatus,
  MaterialItemStatus,
  PickingBatchStatus,
  PickingLineStatus,
  Priority,
  ShipmentStatus,
  StockEntryStatus,
  StockMovementType
} from "@/types";
import { DataAdapter } from "@/services/adapter";
import { localAdapter } from "@/services/local-adapter";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Utilidades de mapeo
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** Campos de sincronizacion para registros que vienen del DB compartido. */
function syncFromDb(row: Row) {
  return {
    externalId: strOrNull(row.id),
    merchanOpsId: strOrNull(row.id),
    sourceSystem: "merchanops" as const,
    syncStatus: "synced" as const,
    lastSyncedAt: null,
    createdAt: str(row.created_at) || new Date().toISOString(),
    updatedAt: str(row.updated_at) || str(row.created_at) || new Date().toISOString(),
    createdBy: strOrNull(row.creado_por ?? row.created_by),
    updatedBy: null
  };
}

/** Mapeo tolerante de estados: valor desconocido → fallback seguro. */
function mapStatus<T extends string>(value: unknown, map: Record<string, T>, fallback: T): T {
  const key = str(value).toLowerCase().trim();
  return map[key] ?? fallback;
}

const requestStatusMap: Record<string, LogisticsRequestStatus> = {
  borrador: "borrador",
  solicitada: "solicitada",
  pendiente_revision: "en_revision",
  en_revision: "en_revision",
  aceptada: "preparando",
  parcialmente_aceptada: "preparando",
  preparando: "preparando",
  pendiente_material: "pendiente_material",
  lista_para_envio: "lista_para_envio",
  enviada: "enviada",
  entregada: "entregada",
  incidencia: "incidencia",
  rechazada: "cancelada",
  cancelada: "cancelada"
};

const priorityMap: Record<string, Priority> = {
  baja: "baja", normal: "normal", media: "normal", alta: "alta", critica: "urgente", urgente: "urgente"
};

const entryStatusMap: Record<string, StockEntryStatus> = {
  pendiente: "pendiente_revision",
  pendiente_revision: "pendiente_revision",
  recibido_completo: "recibida",
  recibida: "recibida",
  recibido_parcial: "parcialmente_recibida",
  parcialmente_recibida: "parcialmente_recibida",
  con_incidencia: "incidencia",
  incidencia: "incidencia",
  rechazado: "rechazada",
  rechazada: "rechazada"
};

const movementTypeMap: Record<string, StockMovementType> = {
  entrada: "entrada",
  salida: "salida",
  ajuste: "ajuste",
  reserva: "reserva",
  liberacion: "liberacion_reserva",
  liberacion_reserva: "liberacion_reserva",
  devolucion: "devolucion",
  incidencia: "incidencia",
  preparacion: "preparacion",
  picking: "salida_picking",
  salida_picking: "salida_picking",
  entrega: "envio",
  envio: "envio"
};

const vinStatusMap: Record<string, MaterialItemStatus> = {
  pendiente: "pendiente_recepcion",
  pendiente_produccion: "pendiente_produccion",
  pendiente_recepcion: "pendiente_recepcion",
  en_almacen: "recibido",
  recibido: "recibido",
  reservado: "reservado",
  preparado: "preparado",
  enviado: "enviado",
  entregado: "enviado",
  instalado: "instalado",
  incidencia: "incidencia",
  duplicado: "duplicado"
};

const pickingStatusMap: Record<string, PickingBatchStatus> = {
  pendiente: "pendiente_preparacion",
  recibido: "pendiente_preparacion",
  pendiente_preparacion: "pendiente_preparacion",
  en_preparacion: "en_preparacion",
  preparado: "preparado_completo",
  listo: "preparado_completo",
  preparado_completo: "preparado_completo",
  con_incidencia: "con_incidencia",
  bloqueado: "bloqueado",
  listo_para_envio: "listo_para_envio",
  enviado: "enviado",
  cerrado: "cerrado",
  cancelado: "cancelado"
};

const pickingLineStatusMap: Record<string, PickingLineStatus> = {
  pendiente: "pendiente",
  parcial: "parcial",
  listo: "preparado",
  preparado: "preparado",
  faltante: "faltante",
  incidencia: "incidencia",
  cancelada: "cancelada"
};

const shipmentStatusMap: Record<string, ShipmentStatus> = {
  pendiente: "pendiente",
  preparado: "preparado",
  enviado: "enviado",
  en_transito: "en_transito",
  entregado: "entregado",
  incidencia: "incidencia",
  devuelto: "devuelto",
  cancelado: "cancelado"
};

// ---------------------------------------------------------------------------
// Lectores por coleccion (query + mapeo a dominio)
// ---------------------------------------------------------------------------

function client() {
  if (!supabase) {
    throw new Error(
      "Supabase no esta configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver docs/SUPABASE_RECONCILIATION.md)."
    );
  }
  return supabase;
}

async function fetchAll(table: string, columns = "*"): Promise<Row[]> {
  const { data, error } = await client().from(table).select(columns);
  if (error) throw new Error(`Supabase (${table}): ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

async function listClients() {
  const rows = await fetchAll("clients");
  return rows.map((r) => ({
    id: str(r.id),
    name: str(r.name || r.nombre),
    ceco: str(r.ceco || r.code || ""),
    description: strOrNull(r.description),
    active: r.active !== false,
    ...syncFromDb(r)
  }));
}

async function listCampaigns() {
  const rows = await fetchAll("grandes_campanas");
  return rows.map((r) => ({
    id: str(r.id),
    clientId: str(r.cliente_id || r.client_id || ""),
    ceco: strOrNull(r.ceco),
    campaignName: str(r.nombre || r.name),
    description: strOrNull(r.descripcion),
    startDate: strOrNull(r.fecha_inicio),
    endDate: strOrNull(r.fecha_fin),
    status: mapStatus(r.estado, {
      borrador: "borrador", planificada: "planificada", activa: "activa",
      pausada: "pausada", finalizada: "finalizada", cancelada: "cancelada"
    } as const, "activa"),
    ...syncFromDb(r)
  }));
}

async function listServices() {
  const rows = await fetchAll("services");
  return rows.map((r) => ({
    id: str(r.id),
    clientId: str(r.client_id || r.cliente_id || ""),
    campaignId: strOrNull(r.campaign_id || r.campana_id),
    serviceName: str(r.name || r.nombre || r.service_name || "(servicio)"),
    serviceCode: str(r.code || r.codigo || r.id),
    pointOfSaleName: strOrNull(r.point_name || r.punto_venta),
    pointOfSaleType: null,
    address: strOrNull(r.address || r.direccion),
    city: strOrNull(r.city || r.ciudad),
    province: strOrNull(r.province || r.provincia),
    postalCode: strOrNull(r.postal_code),
    scheduledDate: strOrNull(r.scheduled_date || r.fecha),
    installationWeek: strOrNull(r.installation_week),
    logisticsStatus: "pendiente" as const,
    materialsRequired: [],
    notes: strOrNull(r.notes || r.observaciones),
    ...syncFromDb(r)
  }));
}

async function listUsers() {
  const rows = await fetchAll("app_users");
  return rows.map((r) => ({
    id: str(r.id),
    username: str(r.username),
    displayName: str(r.display_name || r.username),
    email: null,
    role: (str(r.role) === "admin" ? "administracion" : "gestor") as CollectionTypeMap["users"]["role"],
    active: r.active !== false,
    provinces: Array.isArray(r.provinces) ? (r.provinces as string[]) : [],
    ...syncFromDb(r)
  }));
}

async function listMaterials() {
  const [materials, stock] = await Promise.all([fetchAll("logistics_materials"), fetchAll("logistics_stock")]);
  const stockByMaterial = new Map<string, Row>(stock.map((s) => [str(s.material_id), s]));
  return materials.map((r) => {
    const s = stockByMaterial.get(str(r.id));
    const currentStock = num(s?.cantidad_fisica);
    return {
      id: str(r.id),
      clientId: str(r.cliente_id || ""),
      campaignId: null,
      name: str(r.nombre),
      materialCode: str(r.sku),
      type: mapStatus(r.tipo, {
        vinilo: "vinilo", plv: "plv", display: "display", carteleria: "carteleria",
        muestra: "muestra", promocional: "promocional", generico: "generico"
      } as const, "otro"),
      description: null,
      dimensions: strOrNull(r.medidas),
      heightCm: null,
      widthCm: null,
      unit: str(r.unidad_control || "ud"),
      currentStock,
      reservedStock: num(s?.cantidad_reservada),
      minimumStock: num(r.stock_minimo),
      location: null,
      status: (r.activo === false ? "agotado" : currentStock <= 0 ? "agotado" : "activo") as CollectionTypeMap["materials"]["status"],
      isUnitary: false,
      ...syncFromDb(r)
    };
  });
}

async function listMaterialItems() {
  const rows = await fetchAll("logistics_vins");
  return rows.map((r) => ({
    id: str(r.id),
    itemCode: str(r.vin_id),
    clientId: "",
    campaignId: strOrNull(r.campana_id),
    materialId: strOrNull(r.material_id),
    name: strOrNull(r.farmacia_nombre ? `Vinilo ${str(r.vin_id)}` : r.vin_id),
    type: "vinilo" as const,
    heightCm: null,
    widthCm: null,
    pointOfSaleName: strOrNull(r.farmacia_nombre),
    officeCode: strOrNull(r.farmacia_id),
    address: strOrNull(r.direccion),
    city: null,
    province: null,
    postalCode: null,
    week: null,
    installer: strOrNull(r.instalador_nombre || r.instalador_id),
    route: null,
    wave: null,
    serviceId: null,
    serviceCode: null,
    location: null,
    status: mapStatus(r.estado, vinStatusMap, "recibido"),
    notes: strOrNull(r.medidas ? `Medidas: ${str(r.medidas)}` : null),
    stockEntryId: null,
    importBatchId: null,
    pickingBatchId: strOrNull(r.picking_id),
    pickingLineId: null,
    shipmentId: strOrNull(r.shipment_id),
    incidentId: strOrNull(r.incident_id),
    ...syncFromDb(r)
  }));
}

async function listStockMovements() {
  const rows = await fetchAll("logistics_stock_movements");
  return rows.map((r) => ({
    id: str(r.id),
    materialId: str(r.material_id || ""),
    clientId: null,
    campaignId: strOrNull(r.campana_id),
    type: mapStatus(r.tipo, movementTypeMap, "ajuste"),
    quantity: num(r.cantidad),
    fromLocation: strOrNull(r.origen),
    toLocation: strOrNull(r.destino),
    reason: strOrNull(r.motivo),
    relatedEntityType: null,
    relatedEntityId: strOrNull(r.vin_id),
    ...syncFromDb(r)
  }));
}

async function listStockEntries() {
  const [entries, lines] = await Promise.all([fetchAll("logistics_entries"), fetchAll("logistics_entry_lines")]);
  const byId = new Map<string, Row>(entries.map((e) => [str(e.id), e]));
  // Una StockEntry del dominio por LINEA de entrada (LOGS modela 1 material por entrada).
  return lines.map((l) => {
    const e = byId.get(str(l.entrada_id)) ?? {};
    return {
      id: str(l.id),
      clientId: str(e.client_id || ""),
      campaignId: strOrNull(l.campaign_id ?? e.campaign_id),
      materialId: str(l.material_id || ""),
      quantity: num(l.cantidad_recibida ?? l.cantidad_esperada),
      entryDate: str(e.fecha_recepcion || e.fecha_prevista || e.created_at || ""),
      supplier: strOrNull(e.proveedor_id),
      deliveryNote: strOrNull(e.albaran),
      receivedBy: strOrNull(e.creado_por),
      status: mapStatus(e.estado, entryStatusMap, "pendiente_revision"),
      notes: strOrNull(l.observations ?? e.observaciones),
      ...syncFromDb({ ...e, id: l.id })
    };
  });
}

async function listLogisticsRequests() {
  const [requests, lines] = await Promise.all([fetchAll("logistics_requests"), fetchAll("logistics_request_lines")]);
  const linesByRequest = new Map<string, Row[]>();
  for (const l of lines) {
    const key = str(l.request_id);
    if (!linesByRequest.has(key)) linesByRequest.set(key, []);
    linesByRequest.get(key)!.push(l);
  }
  return requests.map((r) => ({
    id: str(r.id),
    requestCode: str(r.code || r.id),
    clientId: str(r.client_id || ""),
    campaignId: strOrNull(r.campaign_id),
    serviceId: strOrNull(r.service_id),
    requestedBy: strOrNull(r.requested_by),
    assignedTo: strOrNull(r.accepted_by),
    priority: mapStatus(r.priority ?? r.urgency, priorityMap, "normal"),
    status: mapStatus(r.status, requestStatusMap, "solicitada"),
    requestedDate: str(r.requested_at || r.created_at || ""),
    neededByDate: strOrNull(r.required_date),
    materials: (linesByRequest.get(str(r.id)) ?? []).map((l) => ({
      materialId: str(l.material_id || ""),
      quantity: num(l.requested_quantity),
      preparedQuantity: num(l.prepared_quantity),
      notes: strOrNull(l.comment)
    })),
    destination: strOrNull(r.delivery_address ?? r.installer_name),
    notes: strOrNull(r.logistics_comment ?? r.operations_comment),
    ...syncFromDb(r)
  }));
}

async function listPickingBatches() {
  const [pickings, lines] = await Promise.all([fetchAll("logistics_pickings"), fetchAll("logistics_picking_lines")]);
  const linesByPicking = new Map<string, Row[]>();
  for (const l of lines) {
    const key = str(l.picking_id);
    if (!linesByPicking.has(key)) linesByPicking.set(key, []);
    linesByPicking.get(key)!.push(l);
  }
  return pickings.map((p) => ({
    id: str(p.id),
    pickingCode: str(p.codigo || p.id),
    clientId: "",
    campaignId: strOrNull(p.campana_id),
    logisticsRequestId: strOrNull(p.source_request_id),
    importBatchId: null,
    groupingType: (p.instalador_id ? "por_instalador" : "por_punto_venta") as CollectionTypeMap["pickingBatches"]["groupingType"],
    assignedInstaller: strOrNull(p.instalador_id),
    province: strOrNull(p.zona),
    route: null,
    wave: null,
    status: mapStatus(p.estado, pickingStatusMap, "pendiente_preparacion"),
    priority: "normal" as const,
    assignedTo: null,
    closedAt: null,
    notes: null,
    lines: (linesByPicking.get(str(p.id)) ?? []).map((l) => ({
      id: str(l.id),
      materialId: strOrNull(l.material_id),
      materialItemId: strOrNull(l.vin_id),
      description: str(l.vin_id || l.material_id || "(linea)"),
      quantity: num(l.cantidad_esperada) || 1,
      preparedQuantity: num(l.cantidad_preparada),
      status: mapStatus(l.estado, pickingLineStatusMap, "pendiente"),
      pointOfSaleName: strOrNull(l.pharmacy_id),
      officeName: null,
      officeCode: strOrNull(l.pharmacy_id),
      address: strOrNull(l.delivery_address),
      city: null,
      province: null,
      installer: strOrNull(l.installer_id),
      route: null,
      materialType: null,
      dimensions: null,
      location: null,
      serviceCode: null,
      incidentId: null,
      notes: strOrNull(l.justificacion_faltante)
    })),
    ...syncFromDb(p)
  }));
}

async function listShipments() {
  const rows = await fetchAll("logistics_shipments");
  return rows.map((r) => ({
    id: str(r.id),
    shipmentCode: str(r.id).slice(0, 8).toUpperCase(),
    logisticsRequestId: null,
    clientId: null,
    campaignId: null,
    carrier: strOrNull(r.transportista),
    trackingNumber: strOrNull(r.tracking),
    shippingDate: strOrNull(r.fecha_salida),
    estimatedDeliveryDate: strOrNull(r.fecha_estimada_entrega),
    deliveryDate: strOrNull(r.fecha_real_entrega),
    status: mapStatus(r.estado, shipmentStatusMap, "pendiente"),
    destination: strOrNull(r.destinatario_id ?? r.instalador_id),
    notes: null,
    ...syncFromDb(r)
  }));
}

async function listIncidents() {
  const rows = await fetchAll("logistics_incidents");
  return rows.map((r) => ({
    id: str(r.id),
    incidentCode: str(r.codigo || r.id),
    title: str(r.descripcion || r.tipo || "Incidencia"),
    description: strOrNull(r.descripcion),
    clientId: null,
    campaignId: strOrNull(r.campana_id),
    serviceId: null,
    pointOfSaleName: strOrNull(r.farmacia_id),
    materialId: strOrNull(r.material_id),
    materialItemId: strOrNull(r.vin_id),
    shipmentId: strOrNull(r.envio_id),
    logisticsRequestId: null,
    stockEntryId: strOrNull(r.entrada_id),
    pickingBatchId: strOrNull(r.picking_id),
    pickingLineId: null,
    importBatchId: null,
    type: "otra" as const,
    severity: mapStatus(r.impacto, { bajo: "baja", medio: "media", alto: "alta", critico: "critica" } as const, "media"),
    status: mapStatus(r.estado, {
      abierta: "abierta", en_revision: "en_revision", en_curso: "en_curso",
      bloqueada: "bloqueada", resuelta: "resuelta", cancelada: "cancelada"
    } as const, "abierta"),
    assignedTo: strOrNull(r.responsable_id),
    resolvedAt: strOrNull(r.resolved_at),
    resolutionNotes: strOrNull(r.resolution),
    blocksPicking: false,
    ...syncFromDb(r)
  }));
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/** Colecciones sin tabla en el DB compartido: siguen operando en local. */
const LOCAL_ONLY: CollectionName[] = ["requestHistory", "importBatches"];

const readers: { [K in CollectionName]?: () => Promise<CollectionTypeMap[K][]> } = {
  clients: listClients as never,
  campaigns: listCampaigns as never,
  services: listServices as never,
  users: listUsers as never,
  materials: listMaterials as never,
  materialItems: listMaterialItems as never,
  stockMovements: listStockMovements as never,
  stockEntries: listStockEntries as never,
  logisticsRequests: listLogisticsRequests as never,
  pickingBatches: listPickingBatches as never,
  shipments: listShipments as never,
  incidents: listIncidents as never
};

class SupabaseAdapter implements DataAdapter {
  async list<K extends CollectionName>(collection: K): Promise<CollectionTypeMap[K][]> {
    if (LOCAL_ONLY.includes(collection)) return localAdapter.list(collection);
    const reader = readers[collection];
    if (!reader) throw new Error(`Coleccion ${collection} sin mapeo Supabase`);
    return reader() as Promise<CollectionTypeMap[K][]>;
  }

  async get<K extends CollectionName>(collection: K, id: string): Promise<CollectionTypeMap[K] | null> {
    if (LOCAL_ONLY.includes(collection)) return localAdapter.get(collection, id);
    const all = await this.list(collection);
    return all.find((row) => row.id === id) ?? null;
  }

  async insert<K extends CollectionName>(collection: K, entity: CollectionTypeMap[K]): Promise<CollectionTypeMap[K]> {
    if (LOCAL_ONLY.includes(collection)) return localAdapter.insert(collection, entity);
    throw new Error(
      `Escritura en "${collection}" no disponible: la conexion Supabase esta en fase de SOLO LECTURA (fase 3a). Ver docs/SUPABASE_RECONCILIATION.md.`
    );
  }

  async update<K extends CollectionName>(
    collection: K,
    id: string,
    patch: Partial<CollectionTypeMap[K]>
  ): Promise<CollectionTypeMap[K]> {
    if (LOCAL_ONLY.includes(collection)) return localAdapter.update(collection, id, patch);
    throw new Error(
      `Escritura en "${collection}" no disponible: la conexion Supabase esta en fase de SOLO LECTURA (fase 3a). Ver docs/SUPABASE_RECONCILIATION.md.`
    );
  }

  async remove<K extends CollectionName>(collection: K, id: string): Promise<void> {
    if (LOCAL_ONLY.includes(collection)) return localAdapter.remove(collection, id);
    throw new Error(`Borrado en "${collection}" no disponible en fase de solo lectura.`);
  }

  /** JAMAS se re-siembra la base compartida desde MerchanLOGS. */
  async reset(): Promise<void> {
    throw new Error("Reset bloqueado: la base Supabase es compartida con MerchanOPS y no puede re-sembrarse desde LOGS.");
  }
}

export const supabaseAdapter = new SupabaseAdapter();
