/**
 * Adaptador Supabase (fase 3b: lectura + escritura en tablas logistics_*).
 *
 * Conecta MerchanLOGS al proyecto Supabase compartido con MerchanOPS y mapea
 * las tablas reales `logistics_*` (y los maestros de OPS) al dominio de LOGS.
 * El mapeo campo a campo y de estados esta documentado en
 * docs/SUPABASE_RECONCILIATION.md — este fichero es su implementacion.
 *
 * Reglas de co-propiedad (INVARIANTES, no relajar):
 * - `list`/`get` leen de Supabase con mapeadores por coleccion (joins de
 *   stock, lineas de picking/peticion/entrada incluidos).
 * - LOGS escribe SOLO en tablas `logistics_*`. Los maestros de OPS (clients,
 *   grandes_campanas, services, app_users) son de solo lectura SIEMPRE.
 * - Los mapas inversos emiten unicamente valores admitidos por los CHECK
 *   constraints reales del DB (hay un test que lo verifica).
 * - Las columnas de referencia uuid solo reciben uuids reales del DB
 *   (uuidOrNull/requireUuid); jamas texto libre ni ids locales.
 * - Los ids los genera el DB: el id local del dominio se descarta al insertar
 *   y se devuelve la entidad releida con su id definitivo.
 * - `reset()` esta BLOQUEADO: la base compartida jamas se re-siembra desde LOGS.
 * - `requestHistory` e `importBatches` no tienen tabla: siguen en el adaptador
 *   local para que la app funcione completa en modo mixto.
 */

import {
  CollectionName,
  CollectionTypeMap,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  LogisticsRequestStatus,
  MaterialItemStatus,
  MaterialType,
  PickingBatchStatus,
  PickingLine,
  PickingLineStatus,
  Priority,
  ShipmentStatus,
  StockEntryStatus,
  StockMovementType
} from "@/types";
import { DataAdapter } from "@/services/adapter";
import { localAdapter } from "@/services/local-adapter";
import { mirrorPickingLink, mirrorRequestStatus, mirrorShipmentLink } from "@/services/ops-mirror";
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
  // En el vocabulario de OPS "enviada" = peticion presentada a logistica
  // (no "enviada al destino"): se lee como solicitada.
  enviada: "solicitada",
  pendiente_revision: "en_revision",
  en_revision: "en_revision",
  aceptada: "preparando",
  parcialmente_aceptada: "preparando",
  preparando: "preparando",
  en_preparacion: "preparando",
  pendiente_material: "pendiente_material",
  lista_para_envio: "lista_para_envio",
  preparada: "lista_para_envio",
  enviada_transporte: "enviada",
  entregada: "entregada",
  cerrada: "entregada",
  incidencia: "incidencia",
  bloqueada: "incidencia",
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
  consumo: "salida",
  ajuste: "ajuste",
  transferencia: "ajuste",
  reserva: "reserva",
  liberacion: "liberacion_reserva",
  liberacion_reserva: "liberacion_reserva",
  devolucion: "devolucion",
  incidencia: "incidencia",
  danio: "incidencia",
  perdida: "incidencia",
  preparacion: "preparacion",
  picking: "salida_picking",
  salida_picking: "salida_picking",
  entrega: "envio",
  envio: "envio"
};

const vinStatusMap: Record<string, MaterialItemStatus> = {
  pendiente: "pendiente_recepcion",
  pendiente_picking: "recibido",
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
  revisado: "preparado_completo",
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
  recogido: "enviado",
  en_transito: "en_transito",
  entregado: "entregado",
  incidencia: "incidencia",
  fallido: "incidencia",
  extraviado: "incidencia",
  devuelto: "devuelto",
  cancelado: "cancelado"
};

const incidentTypeFromDb: Record<string, IncidentType> = {
  falta: "material_faltante",
  material_no_recibido: "material_faltante",
  incorrecto: "material_incorrecto",
  vin_equivocado: "material_incorrecto",
  medidas: "material_no_encaja",
  medidas_incorrectas: "medidas_incorrectas",
  danado: "rotura",
  material_danado: "rotura",
  perdida: "material_no_localizado",
  sin_picking: "error_picking",
  exceso: "material_duplicado",
  entrega_fallida: "incidencia_transporte",
  defecto_produccion: "incidencia_proveedor"
};

// ---------------------------------------------------------------------------
// Mapas inversos (dominio → DB) para escritura (fase 3b)
//
// IMPORTANTE: las tablas compartidas tienen CHECK constraints con vocabulario
// cerrado. Estos mapas SOLO emiten valores admitidos por esos CHECK (verificado
// contra la base real el 2026-07-10; hay un test que lo garantiza). Los estados
// que LOGS conoce y el DB no (ej. picking "cancelado") se traducen al valor
// admitido mas cercano.
// ---------------------------------------------------------------------------

export const requestStatusToDb: Record<LogisticsRequestStatus, string> = {
  borrador: "borrador",
  solicitada: "enviada",
  en_revision: "pendiente_revision",
  preparando: "en_preparacion",
  pendiente_material: "pendiente_material",
  lista_para_envio: "preparada",
  enviada: "enviada_transporte",
  entregada: "entregada",
  incidencia: "bloqueada",
  cancelada: "cancelada"
};

export const priorityToDb: Record<Priority, string> = {
  baja: "baja",
  normal: "media",
  alta: "alta",
  urgente: "critica"
};

export const entryStatusToDb: Record<StockEntryStatus, string> = {
  pendiente_revision: "pendiente",
  recibida: "recibido_completo",
  parcialmente_recibida: "recibido_parcial",
  incidencia: "con_incidencia",
  rechazada: "rechazado"
};

export const movementTypeToDb: Record<StockMovementType, string> = {
  entrada: "entrada",
  salida: "salida",
  ajuste: "ajuste",
  reserva: "reserva",
  liberacion_reserva: "liberacion",
  devolucion: "devolucion",
  incidencia: "danio",
  preparacion: "picking",
  salida_picking: "picking",
  envio: "entrega"
};

export const vinStatusToDb: Record<MaterialItemStatus, string> = {
  pendiente_produccion: "pendiente_produccion",
  pendiente_recepcion: "pendiente_recepcion",
  recibido: "en_almacen",
  reservado: "reservado",
  preparado: "preparado",
  enviado: "entregado",
  instalado: "instalado",
  incidencia: "incidencia",
  duplicado: "duplicado"
};

export const pickingStatusToDb: Record<PickingBatchStatus, string> = {
  borrador: "pendiente",
  pendiente_preparacion: "pendiente",
  en_preparacion: "en_preparacion",
  preparado_parcial: "en_preparacion",
  preparado_completo: "preparado",
  bloqueado: "en_preparacion",
  con_incidencia: "en_preparacion",
  listo_para_envio: "preparado",
  enviado: "enviado",
  cerrado: "cerrado",
  cancelado: "cerrado"
};

export const pickingLineStatusToDb: Record<PickingLineStatus, string> = {
  pendiente: "pendiente",
  parcial: "pendiente",
  preparado: "listo",
  faltante: "faltante",
  incidencia: "faltante",
  cancelada: "faltante"
};

export const shipmentStatusToDb: Record<ShipmentStatus, string> = {
  pendiente: "pendiente",
  preparado: "preparado",
  enviado: "recogido",
  en_transito: "en_transito",
  entregado: "entregado",
  incidencia: "fallido",
  devuelto: "devuelto",
  cancelado: "fallido"
};

export const incidentStatusToDb: Record<IncidentStatus, string> = {
  abierta: "nueva",
  en_revision: "en_revision",
  en_curso: "en_revision",
  bloqueada: "en_revision",
  resuelta: "resuelta",
  cancelada: "cancelada"
};

export const incidentSeverityToDb: Record<IncidentSeverity, string> = {
  baja: "bajo",
  media: "medio",
  alta: "alto",
  critica: "critico"
};

export const incidentTypeToDb: Record<IncidentType, string> = {
  material_faltante: "falta",
  material_incorrecto: "incorrecto",
  medidas_incorrectas: "medidas_incorrectas",
  material_no_encaja: "medidas",
  material_duplicado: "exceso",
  material_no_localizado: "perdida",
  oficina_incorrecta: "incorrecto",
  error_agrupacion: "sin_picking",
  rotura: "danado",
  retraso_envio: "entrega_fallida",
  error_picking: "sin_picking",
  error_stock: "falta",
  incidencia_proveedor: "defecto_produccion",
  incidencia_transporte: "entrega_fallida",
  otra: "incorrecto"
};

export const materialTypeToDb = (t: MaterialType | undefined): string =>
  t === "vinilo" ? "vinilo_estandar" : "consumible";

export const unitToDb = (u: string | undefined): string => {
  const v = str(u).toLowerCase().trim();
  return ["uds", "rollos", "m2", "cajas"].includes(v) ? v : "uds";
};

/** Formato uuid: unico tipo admitido en columnas de referencia estrictas del DB. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
/** Devuelve el valor solo si es un uuid valido; nunca se escribe texto libre en columnas uuid. */
const uuidOrNull = (v: unknown): string | null => (isUuid(v) ? v : null);

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
        vinilo: "vinilo", vinilo_estandar: "vinilo", vinilo_medida: "vinilo",
        plv: "plv", display: "display", carteleria: "carteleria",
        muestra: "muestra", promocional: "promocional", generico: "generico",
        consumible: "generico", herramienta: "otro"
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
    type: mapStatus(r.tipo, incidentTypeFromDb, "otra"),
    severity: mapStatus(r.impacto, { bajo: "baja", medio: "media", alto: "alta", critico: "critica" } as const, "media"),
    status: mapStatus(r.estado, {
      nueva: "abierta", abierta: "abierta", en_revision: "en_revision", en_curso: "en_curso",
      pend_proveedor: "en_curso", pend_produccion: "en_curso", pend_transporte: "en_curso",
      mat_enviado: "en_curso", bloqueada: "bloqueada", resuelta: "resuelta", cancelada: "cancelada"
    } as const, "abierta"),
    assignedTo: strOrNull(r.responsable_id),
    resolvedAt: strOrNull(r.resolved_at),
    resolutionNotes: strOrNull(r.resolution),
    blocksPicking: false,
    ...syncFromDb(r)
  }));
}

// ---------------------------------------------------------------------------
// Escritura (fase 3b): helpers de acceso
// ---------------------------------------------------------------------------

async function insertRow(table: string, values: Row): Promise<Row> {
  const { data, error } = await client().from(table).insert(values).select().single();
  if (error) throw new Error(`Supabase insert (${table}): ${error.message}`);
  return data as Row;
}

async function updateRow(table: string, id: string, values: Row): Promise<void> {
  if (!Object.keys(values).length) return;
  const { error } = await client().from(table).update(values).eq("id", id);
  if (error) throw new Error(`Supabase update (${table}): ${error.message}`);
}

async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await client().from(table).delete().eq("id", id);
  if (error) throw new Error(`Supabase delete (${table}): ${error.message}`);
}

/** Exige que la referencia sea un uuid del DB compartido (no un id local). */
function requireUuid(value: unknown, what: string): string {
  if (!isUuid(value)) {
    throw new Error(
      `${what} debe ser un id del DB compartido (uuid); se recibio "${str(value)}". ` +
        "En modo Supabase las referencias deben provenir de entidades leidas de la propia base."
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Escritores por coleccion (dominio → tablas reales)
//
// Reglas de co-propiedad (docs/SUPABASE_RECONCILIATION.md):
// - LOGS escribe SOLO en tablas logistics_*.
// - Los maestros de OPS (clients, grandes_campanas, services, app_users) son
//   de solo lectura SIEMPRE: no hay escritor y el adapter lo bloquea.
// - Los ids los genera el DB (uuid); el id local del dominio se descarta y el
//   servicio recibe la entidad releida con su id definitivo.
// ---------------------------------------------------------------------------

type Entity<K extends CollectionName> = CollectionTypeMap[K];

interface CollectionWriter<K extends CollectionName> {
  /** Inserta y devuelve el id definitivo generado por el DB. */
  insert(entity: Entity<K>): Promise<string>;
  update(id: string, patch: Partial<Entity<K>>): Promise<void>;
  remove(id: string): Promise<void>;
}

const materialsWriter: CollectionWriter<"materials"> = {
  async insert(m) {
    const row = await insertRow("logistics_materials", {
      sku: m.materialCode || `LOGS-${Date.now()}`,
      nombre: m.name,
      tipo: materialTypeToDb(m.type),
      unidad_control: unitToDb(m.unit),
      stock_minimo: m.minimumStock ?? 0,
      medidas: m.dimensions ?? null,
      cliente_id: m.clientId || null
    });
    await insertRow("logistics_stock", {
      material_id: row.id,
      cantidad_fisica: m.currentStock ?? 0,
      cantidad_reservada: m.reservedStock ?? 0
    });
    return str(row.id);
  },
  async update(id, patch) {
    const mat: Row = {};
    if (patch.name !== undefined) mat.nombre = patch.name;
    if (patch.materialCode !== undefined) mat.sku = patch.materialCode;
    if (patch.type !== undefined) mat.tipo = materialTypeToDb(patch.type);
    if (patch.unit !== undefined) mat.unidad_control = unitToDb(patch.unit);
    if (patch.minimumStock !== undefined) mat.stock_minimo = patch.minimumStock;
    if (patch.dimensions !== undefined) mat.medidas = patch.dimensions;
    // Nota: NO se escribe `activo` desde LOGS. El estado "agotado" del dominio
    // se deriva del stock en lectura; desactivar el material afectaria a OPS.
    await updateRow("logistics_materials", id, mat);

    const stock: Row = {};
    if (patch.currentStock !== undefined) stock.cantidad_fisica = patch.currentStock;
    if (patch.reservedStock !== undefined) stock.cantidad_reservada = patch.reservedStock;
    if (Object.keys(stock).length) {
      const { data, error } = await client()
        .from("logistics_stock")
        .update(stock)
        .eq("material_id", id)
        .select("id");
      if (error) throw new Error(`Supabase update (logistics_stock): ${error.message}`);
      if (!data?.length) {
        await insertRow("logistics_stock", {
          material_id: id,
          cantidad_fisica: patch.currentStock ?? 0,
          cantidad_reservada: patch.reservedStock ?? 0
        });
      }
    }
  },
  async remove(id) {
    // El stock del material se elimina junto al material para no dejar huerfanos.
    const { error } = await client().from("logistics_stock").delete().eq("material_id", id);
    if (error) throw new Error(`Supabase delete (logistics_stock): ${error.message}`);
    await deleteRow("logistics_materials", id);
  }
};

const materialItemsWriter: CollectionWriter<"materialItems"> = {
  async insert(i) {
    const row = await insertRow("logistics_vins", {
      vin_id: i.itemCode,
      campana_id: i.campaignId ?? null,
      material_id: uuidOrNull(i.materialId),
      farmacia_nombre: i.pointOfSaleName ?? null,
      farmacia_id: i.officeCode ?? null,
      direccion: i.address ?? null,
      instalador_nombre: i.installer ?? null,
      estado: vinStatusToDb[i.status] ?? "en_almacen",
      picking_id: uuidOrNull(i.pickingBatchId),
      shipment_id: uuidOrNull(i.shipmentId),
      incident_id: uuidOrNull(i.incidentId)
    });
    return str(row.id);
  },
  async update(id, patch) {
    const row: Row = { updated_at: new Date().toISOString() };
    if (patch.itemCode !== undefined) row.vin_id = patch.itemCode;
    if (patch.campaignId !== undefined) row.campana_id = patch.campaignId;
    if (patch.materialId !== undefined) row.material_id = uuidOrNull(patch.materialId);
    if (patch.pointOfSaleName !== undefined) row.farmacia_nombre = patch.pointOfSaleName;
    if (patch.officeCode !== undefined) row.farmacia_id = patch.officeCode;
    if (patch.address !== undefined) row.direccion = patch.address;
    if (patch.installer !== undefined) row.instalador_nombre = patch.installer;
    if (patch.status !== undefined) row.estado = vinStatusToDb[patch.status] ?? "en_almacen";
    if (patch.pickingBatchId !== undefined) row.picking_id = uuidOrNull(patch.pickingBatchId);
    if (patch.shipmentId !== undefined) row.shipment_id = uuidOrNull(patch.shipmentId);
    if (patch.incidentId !== undefined) row.incident_id = uuidOrNull(patch.incidentId);
    await updateRow("logistics_vins", id, row);
  },
  async remove(id) {
    await deleteRow("logistics_vins", id);
  }
};

const stockMovementsWriter: CollectionWriter<"stockMovements"> = {
  async insert(m) {
    const row = await insertRow("logistics_stock_movements", {
      material_id: requireUuid(m.materialId, "stockMovements.materialId"),
      tipo: movementTypeToDb[m.type] ?? "ajuste",
      cantidad: m.quantity,
      motivo: m.reason || "Movimiento registrado desde MerchanLOGS",
      origen: m.fromLocation ?? null,
      destino: m.toLocation ?? null,
      campana_id: m.campaignId ?? null,
      vin_id: m.relatedEntityType === "material_item" ? m.relatedEntityId ?? null : null
    });
    return str(row.id);
  },
  async update() {
    throw new Error("Los movimientos de stock son inmutables: no se editan (trazabilidad).");
  },
  async remove() {
    throw new Error("Los movimientos de stock son inmutables: no se borran (trazabilidad).");
  }
};

const stockEntriesWriter: CollectionWriter<"stockEntries"> = {
  // LOGS modela 1 entrada = 1 material; en el DB es cabecera + lineas.
  // El id de dominio es el id de LINEA (igual que en lectura).
  async insert(e) {
    const parent = await insertRow("logistics_entries", {
      albaran: e.deliveryNote || `LOGS-${Date.now()}`,
      estado: entryStatusToDb[e.status] ?? "pendiente",
      fecha_recepcion: e.entryDate ? e.entryDate.slice(0, 10) : null,
      observaciones: e.notes ?? null,
      client_id: e.clientId || null,
      proveedor_id: e.supplier ?? null
    });
    const line = await insertRow("logistics_entry_lines", {
      entrada_id: parent.id,
      material_id: requireUuid(e.materialId, "stockEntries.materialId"),
      cantidad_esperada: e.quantity,
      cantidad_recibida: e.quantity,
      campaign_id: e.campaignId ?? null,
      observations: e.notes ?? null
    });
    return str(line.id);
  },
  async update(id, patch) {
    const { data, error } = await client()
      .from("logistics_entry_lines")
      .select("entrada_id")
      .eq("id", id)
      .single();
    if (error) throw new Error(`Supabase (logistics_entry_lines): ${error.message}`);

    const line: Row = {};
    if (patch.quantity !== undefined) {
      line.cantidad_recibida = patch.quantity;
      line.cantidad_esperada = patch.quantity;
    }
    if (patch.notes !== undefined) line.observations = patch.notes;
    if (patch.campaignId !== undefined) line.campaign_id = patch.campaignId;
    await updateRow("logistics_entry_lines", id, line);

    const parent: Row = {};
    if (patch.status !== undefined) parent.estado = entryStatusToDb[patch.status] ?? "pendiente";
    if (patch.entryDate !== undefined) parent.fecha_recepcion = patch.entryDate ? patch.entryDate.slice(0, 10) : null;
    if (patch.deliveryNote !== undefined) parent.albaran = patch.deliveryNote ?? "LOGS-sin-albaran";
    if (patch.supplier !== undefined) parent.proveedor_id = patch.supplier;
    await updateRow("logistics_entries", str(data.entrada_id), parent);
  },
  async remove(id) {
    // Solo se elimina la linea; la cabecera puede tener otras lineas (de OPS).
    await deleteRow("logistics_entry_lines", id);
  }
};

const logisticsRequestsWriter: CollectionWriter<"logisticsRequests"> = {
  async insert(r) {
    const row = await insertRow("logistics_requests", {
      code: r.requestCode || `LOGS-${Date.now()}`,
      source_type: "manual_request",
      source_id: r.serviceId || r.clientId || "merchanlogs",
      client_id: r.clientId || null,
      campaign_id: r.campaignId ?? null,
      service_id: r.serviceId ?? null,
      requested_by: r.requestedBy ?? null,
      priority: priorityToDb[r.priority] ?? "media",
      status: requestStatusToDb[r.status] ?? "pendiente_revision",
      required_date: r.neededByDate ? r.neededByDate.slice(0, 10) : null,
      delivery_address: r.destination ?? null,
      logistics_comment: r.notes ?? null
    });
    for (const line of r.materials ?? []) {
      await insertRow("logistics_request_lines", {
        request_id: row.id,
        material_id: requireUuid(line.materialId, "logisticsRequests.materials[].materialId"),
        requested_quantity: line.quantity,
        prepared_quantity: line.preparedQuantity ?? 0,
        comment: line.notes ?? null
      });
    }
    return str(row.id);
  },
  async update(id, patch) {
    const row: Row = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) row.status = requestStatusToDb[patch.status] ?? "pendiente_revision";
    if (patch.priority !== undefined) row.priority = priorityToDb[patch.priority] ?? "media";
    if (patch.neededByDate !== undefined)
      row.required_date = patch.neededByDate ? patch.neededByDate.slice(0, 10) : null;
    if (patch.destination !== undefined) row.delivery_address = patch.destination;
    if (patch.notes !== undefined) row.logistics_comment = patch.notes;
    await updateRow("logistics_requests", id, row);
    // Retorno en tiempo real hacia OPS: necesidades y tarjetas de servicios/ISDIN.
    if (typeof row.status === "string") await mirrorRequestStatus(id, row.status);

    if (patch.materials) {
      const { data, error } = await client()
        .from("logistics_request_lines")
        .select("id, material_id")
        .eq("request_id", id);
      if (error) throw new Error(`Supabase (logistics_request_lines): ${error.message}`);
      const existing = new Map((data ?? []).map((l) => [str(l.material_id), str(l.id)]));
      const keep = new Set<string>();
      for (const line of patch.materials) {
        const lineId = existing.get(str(line.materialId));
        if (lineId) {
          keep.add(lineId);
          await updateRow("logistics_request_lines", lineId, {
            requested_quantity: line.quantity,
            prepared_quantity: line.preparedQuantity ?? 0,
            comment: line.notes ?? null
          });
        } else {
          const created = await insertRow("logistics_request_lines", {
            request_id: id,
            material_id: requireUuid(line.materialId, "logisticsRequests.materials[].materialId"),
            requested_quantity: line.quantity,
            prepared_quantity: line.preparedQuantity ?? 0,
            comment: line.notes ?? null
          });
          keep.add(str(created.id));
        }
      }
      for (const lineId of Array.from(existing.values())) {
        if (!keep.has(lineId)) await deleteRow("logistics_request_lines", lineId);
      }
    }
  },
  async remove(id) {
    await deleteRow("logistics_requests", id); // las lineas caen en cascada (FK)
  }
};

function pickingLineToDb(pickingId: string, l: PickingLine): Row {
  const cancelled = l.status === "cancelada";
  return {
    picking_id: pickingId,
    material_id: uuidOrNull(l.materialId),
    vin_id: l.materialItemId ?? null,
    cantidad_esperada: l.quantity ?? 0,
    cantidad_preparada: l.preparedQuantity ?? 0,
    estado: pickingLineStatusToDb[l.status] ?? "pendiente",
    pharmacy_id: l.officeCode ?? l.pointOfSaleName ?? null,
    delivery_address: l.address ?? null,
    installer_id: l.installer ?? null,
    justificacion_faltante: cancelled ? l.notes ?? "Linea cancelada en MerchanLOGS" : l.notes ?? null
  };
}

const pickingBatchesWriter: CollectionWriter<"pickingBatches"> = {
  async insert(p) {
    const row = await insertRow("logistics_pickings", {
      codigo: p.pickingCode || `PCK-LOGS-${Date.now()}`,
      campana_id: p.campaignId ?? null,
      source_request_id: uuidOrNull(p.logisticsRequestId),
      instalador_id: p.assignedInstaller ?? null,
      zona: p.province ?? null,
      estado: pickingStatusToDb[p.status] ?? "pendiente",
      num_puntos: p.lines?.length ?? 0
    });
    for (const line of p.lines ?? []) {
      await insertRow("logistics_picking_lines", pickingLineToDb(str(row.id), line));
    }
    // Retorno hacia OPS: enlaza el picking con las necesidades de su peticion.
    if (isUuid(p.logisticsRequestId)) await mirrorPickingLink(p.logisticsRequestId, str(row.id));
    return str(row.id);
  },
  async update(id, patch) {
    const row: Row = {};
    if (patch.status !== undefined) row.estado = pickingStatusToDb[patch.status] ?? "pendiente";
    if (patch.province !== undefined) row.zona = patch.province;
    if (patch.assignedInstaller !== undefined) row.instalador_id = patch.assignedInstaller;
    if (patch.campaignId !== undefined) row.campana_id = patch.campaignId;
    if (patch.logisticsRequestId !== undefined) row.source_request_id = uuidOrNull(patch.logisticsRequestId);
    if (patch.lines) row.num_puntos = patch.lines.length;
    await updateRow("logistics_pickings", id, row);

    if (patch.lines) {
      const { data, error } = await client()
        .from("logistics_picking_lines")
        .select("id")
        .eq("picking_id", id);
      if (error) throw new Error(`Supabase (logistics_picking_lines): ${error.message}`);
      const existing = new Set((data ?? []).map((l) => str(l.id)));
      const keep = new Set<string>();
      for (const line of patch.lines) {
        if (isUuid(line.id) && existing.has(line.id)) {
          keep.add(line.id);
          const values = pickingLineToDb(id, line);
          delete values.picking_id; // no se re-vincula
          await updateRow("logistics_picking_lines", line.id, values);
        } else {
          const created = await insertRow("logistics_picking_lines", pickingLineToDb(id, line));
          keep.add(str(created.id));
        }
      }
      for (const lineId of Array.from(existing)) {
        if (!keep.has(lineId)) await deleteRow("logistics_picking_lines", lineId);
      }
    }
  },
  async remove(id) {
    await deleteRow("logistics_pickings", id); // lineas en cascada; si hay envios enlazados el DB lo impide
  }
};

const shipmentsWriter: CollectionWriter<"shipments"> = {
  async insert(s) {
    const row = await insertRow("logistics_shipments", {
      transportista: s.carrier ?? null,
      tracking: s.trackingNumber ?? null,
      fecha_salida: s.shippingDate ?? null,
      fecha_estimada_entrega: s.estimatedDeliveryDate ?? null,
      fecha_real_entrega: s.deliveryDate ?? null,
      estado: shipmentStatusToDb[s.status] ?? "pendiente",
      destinatario_id: s.destination ?? null
    });
    // Retorno hacia OPS: enlaza el envio con la peticion y sus necesidades.
    if (isUuid(s.logisticsRequestId)) await mirrorShipmentLink(s.logisticsRequestId, str(row.id));
    return str(row.id);
  },
  async update(id, patch) {
    const row: Row = {};
    if (patch.carrier !== undefined) row.transportista = patch.carrier;
    if (patch.trackingNumber !== undefined) row.tracking = patch.trackingNumber;
    if (patch.shippingDate !== undefined) row.fecha_salida = patch.shippingDate;
    if (patch.estimatedDeliveryDate !== undefined) row.fecha_estimada_entrega = patch.estimatedDeliveryDate;
    if (patch.deliveryDate !== undefined) row.fecha_real_entrega = patch.deliveryDate;
    if (patch.status !== undefined) row.estado = shipmentStatusToDb[patch.status] ?? "pendiente";
    if (patch.destination !== undefined) row.destinatario_id = patch.destination;
    await updateRow("logistics_shipments", id, row);
  },
  async remove(id) {
    await deleteRow("logistics_shipments", id);
  }
};

const incidentsWriter: CollectionWriter<"incidents"> = {
  async insert(i) {
    // El dominio referencia entradas por id de LINEA; el DB por cabecera.
    let entradaId: string | null = null;
    if (isUuid(i.stockEntryId)) {
      const { data } = await client()
        .from("logistics_entry_lines")
        .select("entrada_id")
        .eq("id", i.stockEntryId)
        .maybeSingle();
      entradaId = uuidOrNull(data?.entrada_id);
    }
    const row = await insertRow("logistics_incidents", {
      codigo: i.incidentCode || `INC-LOGS-${Date.now()}`,
      tipo: incidentTypeToDb[i.type] ?? "incorrecto",
      descripcion: i.description || i.title || "Incidencia registrada en MerchanLOGS",
      estado: incidentStatusToDb[i.status] ?? "nueva",
      impacto: incidentSeverityToDb[i.severity] ?? "medio",
      campana_id: i.campaignId ?? null,
      farmacia_id: i.pointOfSaleName ?? null,
      material_id: uuidOrNull(i.materialId),
      vin_id: i.materialItemId ?? null,
      envio_id: uuidOrNull(i.shipmentId),
      entrada_id: entradaId,
      picking_id: uuidOrNull(i.pickingBatchId),
      responsable_id: i.assignedTo ?? null,
      resolved_at: i.resolvedAt ?? null,
      resolution: i.resolutionNotes ?? null
    });
    return str(row.id);
  },
  async update(id, patch) {
    const row: Row = {};
    if (patch.type !== undefined) row.tipo = incidentTypeToDb[patch.type] ?? "incorrecto";
    if (patch.description !== undefined || patch.title !== undefined) {
      const text = patch.description ?? patch.title;
      if (text) row.descripcion = text;
    }
    if (patch.status !== undefined) row.estado = incidentStatusToDb[patch.status] ?? "nueva";
    if (patch.severity !== undefined) row.impacto = incidentSeverityToDb[patch.severity] ?? "medio";
    if (patch.assignedTo !== undefined) row.responsable_id = patch.assignedTo;
    if (patch.resolvedAt !== undefined) row.resolved_at = patch.resolvedAt;
    if (patch.resolutionNotes !== undefined) row.resolution = patch.resolutionNotes;
    if (patch.pointOfSaleName !== undefined) row.farmacia_id = patch.pointOfSaleName;
    if (patch.materialId !== undefined) row.material_id = uuidOrNull(patch.materialId);
    if (patch.materialItemId !== undefined) row.vin_id = patch.materialItemId;
    if (patch.shipmentId !== undefined) row.envio_id = uuidOrNull(patch.shipmentId);
    if (patch.pickingBatchId !== undefined) row.picking_id = uuidOrNull(patch.pickingBatchId);
    await updateRow("logistics_incidents", id, row);
  },
  async remove(id) {
    await deleteRow("logistics_incidents", id);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const writers: { [K in CollectionName]?: CollectionWriter<any> } = {
  materials: materialsWriter,
  materialItems: materialItemsWriter,
  stockMovements: stockMovementsWriter,
  stockEntries: stockEntriesWriter,
  logisticsRequests: logisticsRequestsWriter,
  pickingBatches: pickingBatchesWriter,
  shipments: shipmentsWriter,
  incidents: incidentsWriter
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/** Colecciones sin tabla en el DB compartido: siguen operando en local. */
const LOCAL_ONLY: CollectionName[] = ["requestHistory", "importBatches"];

/** Maestros propiedad de MerchanOPS: LOGS los lee pero JAMAS los escribe. */
const OPS_MASTERS: CollectionName[] = ["clients", "campaigns", "services", "users"];

function assertWritable(collection: CollectionName): void {
  if (OPS_MASTERS.includes(collection)) {
    throw new Error(
      `La coleccion "${collection}" es un maestro propiedad de MerchanOPS: MerchanLOGS solo puede leerla (ver docs/SUPABASE_RECONCILIATION.md).`
    );
  }
}

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
    assertWritable(collection);
    const writer = writers[collection];
    if (!writer) throw new Error(`Coleccion ${collection} sin escritor Supabase`);
    // El id local se descarta: el DB genera el uuid definitivo y se relee la
    // entidad ya mapeada para que el llamante trabaje con el registro real.
    const newId = await writer.insert(entity);
    const created = await this.get(collection, newId);
    if (!created) throw new Error(`Supabase: el registro creado en ${collection} no pudo releerse (${newId}).`);
    return created;
  }

  async update<K extends CollectionName>(
    collection: K,
    id: string,
    patch: Partial<CollectionTypeMap[K]>
  ): Promise<CollectionTypeMap[K]> {
    if (LOCAL_ONLY.includes(collection)) return localAdapter.update(collection, id, patch);
    assertWritable(collection);
    const writer = writers[collection];
    if (!writer) throw new Error(`Coleccion ${collection} sin escritor Supabase`);
    await writer.update(id, patch);
    const updated = await this.get(collection, id);
    if (!updated) throw new Error(`Supabase: registro ${id} no encontrado en ${collection} tras actualizar.`);
    return updated;
  }

  async remove<K extends CollectionName>(collection: K, id: string): Promise<void> {
    if (LOCAL_ONLY.includes(collection)) return localAdapter.remove(collection, id);
    assertWritable(collection);
    const writer = writers[collection];
    if (!writer) throw new Error(`Coleccion ${collection} sin escritor Supabase`);
    await writer.remove(id);
  }

  /** JAMAS se re-siembra la base compartida desde MerchanLOGS. */
  async reset(): Promise<void> {
    throw new Error("Reset bloqueado: la base Supabase es compartida con MerchanOPS y no puede re-sembrarse desde LOGS.");
  }
}

export const supabaseAdapter = new SupabaseAdapter();
