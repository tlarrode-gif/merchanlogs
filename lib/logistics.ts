export const logisticsLocalKey = "merchanlogs_logistics_v1";

export type MaterialType = "vinilo_estandar" | "vinilo_medida" | "herramienta" | "consumible";
export type StockMoveType = "entrada" | "salida" | "reserva" | "liberacion" | "picking" | "entrega" | "consumo" | "devolucion" | "danio" | "perdida" | "ajuste" | "transferencia";
export type EntryStatus = "pendiente" | "recibido_parcial" | "recibido_completo" | "con_incidencia" | "rechazado" | "cerrado";
export type PickingStatus = "pendiente" | "en_preparacion" | "preparado" | "revisado" | "enviado" | "recibido" | "cerrado";
export type ShippingStatus = "pendiente" | "preparado" | "recogido" | "en_transito" | "entregado" | "fallido" | "extraviado" | "devuelto";
export type IncidentType = "sin_picking" | "medidas" | "danado" | "incorrecto" | "falta" | "exceso" | "perdida" | "entrega_fallida" | "defecto_produccion" | "material_no_recibido" | "medidas_incorrectas" | "material_danado" | "vin_equivocado" | "instalacion_no_realizada" | "farmacia_cerrada" | "escaparate_cambiado" | "material_sobrante";
export type IncidentStatus = "nueva" | "en_revision" | "pend_proveedor" | "pend_produccion" | "pend_transporte" | "mat_enviado" | "resuelta" | "cancelada";
export type PendingStatus = "pend_proveedor" | "en_produccion" | "en_transito" | "recibido" | "asignado_picking" | "cerrado";
export type RequirementSourceType = "service" | "service_point" | "isdin_vinyl" | "campaign" | "incident" | "replacement" | "manual_request";
export type RequirementStatus = "pendiente_revision" | "aceptada" | "pendiente_stock" | "pendiente_produccion" | "pendiente_recepcion" | "parcialmente_disponible" | "disponible" | "reservada" | "en_picking" | "preparada" | "enviada" | "entregada" | "consumida" | "cancelada" | "bloqueada" | "con_incidencia";
export type RequestStatus = "borrador" | "enviada" | "pendiente_revision" | "aceptada" | "parcialmente_aceptada" | "rechazada" | "pendiente_material" | "en_preparacion" | "preparada" | "enviada_transporte" | "entregada" | "cerrada" | "cancelada" | "bloqueada";
export type LogisticsPriority = "critica" | "alta" | "media" | "baja";
export type IntegrationEventStatus = "pendiente" | "procesando" | "completado" | "error";
export type LogisticsVinStatus = "pendiente_recepcion" | "pendiente_picking" | "en_almacen" | "en_picking" | "enviado" | "entregado" | "con_incidencia" | "bloqueado" | "cancelado";

export type Material = { id: string; sku: string; nombre: string; cliente_id?: string | null; tipo: MaterialType; medidas?: string | null; unidad_control: "uds" | "rollos" | "m2" | "cajas"; stock_minimo: number; stock_objetivo: number; proveedor_id?: string | null; coste?: number | null; activo: boolean };
export type EntryLine = { id: string; entrada_id: string; material_id: string; cantidad_esperada: number; cantidad_recibida: number; cantidad_correcta: number; cantidad_danada: number; diferencia: number; incidencia_id?: string | null };
export type Entry = { id: string; albaran: string; fecha_prevista: string; fecha_recepcion?: string | null; proveedor_id?: string | null; transportista?: string | null; num_bultos_esperado: number; num_bultos_recibido: number; estado: EntryStatus; observaciones?: string | null; creado_por?: string | null; lineas: EntryLine[] };
export type Stock = { id: string; material_id: string; cantidad_fisica: number; cantidad_reservada: number; cantidad_picking: number; cantidad_bloqueada: number };
export type StockMovement = { id: string; material_id: string; tipo: StockMoveType; cantidad: number; origen?: string | null; destino?: string | null; usuario_id?: string | null; campana_id?: string | null; vin_id?: string | null; motivo: string; created_at: string };
export type PickingLine = { id: string; picking_id: string; material_id: string; vin_id?: string | null; cantidad_esperada: number; cantidad_preparada: number; estado: "pendiente" | "listo" | "faltante"; justificacion_faltante?: string | null };
export type Picking = { id: string; codigo: string; instalador_id?: string | null; campana_id?: string | null; zona?: string | null; fecha_salida_prevista?: string | null; estado: PickingStatus; num_puntos: number; lineas: PickingLine[]; envio_id?: string | null };
export type Shipping = { id: string; picking_id: string; fecha_salida?: string | null; transportista?: string | null; tracking?: string | null; destinatario_id?: string | null; instalador_id?: string | null; num_bultos: number; fecha_estimada_entrega?: string | null; fecha_real_entrega?: string | null; confirmado_por_instalador: boolean; estado: ShippingStatus };
export type Incident = { id: string; codigo: string; tipo: IncidentType; material_id?: string | null; vin_id?: string | null; campana_id?: string | null; farmacia_id?: string | null; picking_id?: string | null; envio_id?: string | null; entrada_id?: string | null; responsable_id?: string | null; fecha_deteccion: string; descripcion: string; impacto?: string | null; fecha_limite?: string | null; estado: IncidentStatus; pendiente_llegada_id?: string | null; resolution?: string | null; resolved_at?: string | null };
export type PendingArrival = { id: string; incidencia_id: string; vin_id?: string | null; material_id?: string | null; motivo: string; fecha_solicitud: string; fecha_prevista?: string | null; fecha_instalacion?: string | null; proveedor_id?: string | null; estado: PendingStatus; en_riesgo?: boolean };
export type MaterialRequirement = { id: string; source_type: RequirementSourceType; source_id: string; source_line_id?: string | null; client_id?: string | null; campaign_id?: string | null; service_id?: string | null; service_point_id?: string | null; isdin_vinyl_id?: string | null; vin?: string | null; pharmacy_id?: string | null; pharmacy_name?: string | null; material_id?: string | null; requested_material_name: string; requested_sku?: string | null; material_type: MaterialType; requested_quantity: number; unit: "uds" | "rollos" | "m2" | "cajas"; width?: number | null; height?: number | null; custom_specifications?: string | null; required_date?: string | null; installation_date?: string | null; installation_week?: string | null; province?: string | null; city?: string | null; delivery_address?: string | null; installer_id?: string | null; installer_name?: string | null; priority: LogisticsPriority; status: RequirementStatus; logistics_notes?: string | null; operations_notes?: string | null; created_at: string; updated_at: string; created_by?: string | null; request_id?: string | null; picking_id?: string | null; shipment_id?: string | null; incident_id?: string | null; pending_arrival_id?: string | null; received_quantity?: number; reserved_quantity?: number; prepared_quantity?: number; delivered_quantity?: number; source_system?: string | null; sync_event_id?: string | null };
export type LogisticsRequestLine = { id: string; request_id: string; material_requirement_id: string; material_id?: string | null; requested_quantity: number; accepted_quantity: number; prepared_quantity: number; delivered_quantity: number; missing_quantity: number; substitution_material_id?: string | null; substitution_status?: "propuesta" | "aceptada" | "rechazada" | null; line_status: RequirementStatus; comment?: string | null };
export type LogisticsRequest = { id: string; code: string; source_type: RequirementSourceType; source_id: string; client_id?: string | null; campaign_id?: string | null; service_id?: string | null; requested_by?: string | null; requested_at: string; required_date?: string | null; installation_date?: string | null; priority: LogisticsPriority; destination_type: "instalador" | "farmacia" | "almacen" | "otro"; installer_id?: string | null; installer_name?: string | null; delivery_address?: string | null; province?: string | null; city?: string | null; status: RequestStatus; accepted_by?: string | null; accepted_at?: string | null; rejection_reason?: string | null; logistics_comment?: string | null; operations_comment?: string | null; picking_id?: string | null; shipment_id?: string | null; created_at: string; updated_at: string; lines: LogisticsRequestLine[]; source_system?: string | null; sync_event_id?: string | null; requires_review?: boolean };
export type IntegrationEvent = { id: string; event_type: string; source_type: string; source_id: string; idempotency_key: string; payload: Record<string, unknown>; status: IntegrationEventStatus; attempts: number; last_error?: string | null; created_at: string; processed_at?: string | null };
export type LogisticsAuditEntry = { id: string; actor?: string | null; module: string; entity_type: string; entity_id: string; action: string; previous_value?: unknown; new_value?: unknown; reason?: string | null; sync_event_id?: string | null; created_at: string };
export type LogisticsNotification = { id: string; type: string; priority: LogisticsPriority; responsible?: string | null; entity_type: string; entity_id: string; href: string; message: string; read: boolean; resolved: boolean; created_at: string };
export type LogisticsVin = { id: string; vin_id: string; material_id?: string | null; campana_id?: string | null; farmacia_id?: string | null; farmacia_nombre?: string | null; direccion?: string | null; telefono?: string | null; responsable?: string | null; instalador_id?: string | null; instalador_nombre?: string | null; medidas?: string | null; estado: LogisticsVinStatus; picking_id?: string | null; shipment_id?: string | null; incident_id?: string | null; pending_arrival_id?: string | null; updated_at: string; created_at: string };
export type SyncLogEntry = { id: string; evento: string; origen_modulo: string; destino_modulo: string; entidad_id?: string | null; usuario_id?: string | null; payload: Record<string, unknown>; resultado: "ok" | "error"; error_message?: string | null; created_at: string };
export type LogisticsState = { materials: Material[]; entries: Entry[]; stock: Stock[]; movements: StockMovement[]; pickings: Picking[]; shipments: Shipping[]; incidents: Incident[]; pendings: PendingArrival[]; requirements: MaterialRequirement[]; requests: LogisticsRequest[]; events: IntegrationEvent[]; audit: LogisticsAuditEntry[]; notifications: LogisticsNotification[]; vins: LogisticsVin[]; syncLogs: SyncLogEntry[] };

export function uid(prefix = "id") {
  void prefix;
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function available(stock?: Stock | null) {
  return stock ? stock.cantidad_fisica - stock.cantidad_reservada - stock.cantidad_picking - stock.cantidad_bloqueada : 0;
}

export function seedLogistics(): LogisticsState {
  const m1: Material = { id: "11111111-1111-4111-8111-111111111111", sku: "VIN-STD-120", nombre: "Vinilo estándar 120x150", tipo: "vinilo_estandar", medidas: "120x150", unidad_control: "uds", stock_minimo: 8, stock_objetivo: 25, proveedor_id: "prov_isdin", coste: 15, activo: true };
  const m2: Material = { id: "22222222-2222-4222-8222-222222222222", sku: "KIT-INST", nombre: "Kit instalación vinilo", tipo: "herramienta", unidad_control: "cajas", stock_minimo: 3, stock_objetivo: 10, proveedor_id: "prov_tools", coste: 22, activo: true };
  return {
    materials: [m1, m2], entries: [],
    stock: [
      { id: "33333333-3333-4333-8333-333333333333", material_id: m1.id, cantidad_fisica: 14, cantidad_reservada: 2, cantidad_picking: 0, cantidad_bloqueada: 0 },
      { id: "44444444-4444-4444-8444-444444444444", material_id: m2.id, cantidad_fisica: 2, cantidad_reservada: 0, cantidad_picking: 0, cantidad_bloqueada: 0 }
    ],
    movements: [], pickings: [], shipments: [], incidents: [], pendings: [], requirements: [], requests: [], events: [], audit: [], notifications: [], vins: [], syncLogs: []
  };
}

export function normalizeLogisticsState(raw: Partial<LogisticsState> | null | undefined): LogisticsState {
  const seed = seedLogistics();
  return {
    materials: raw?.materials || seed.materials,
    entries: raw?.entries || [],
    stock: raw?.stock || seed.stock,
    movements: raw?.movements || [],
    pickings: raw?.pickings || [],
    shipments: raw?.shipments || [],
    incidents: raw?.incidents || [],
    pendings: raw?.pendings || [],
    requirements: raw?.requirements || [],
    requests: raw?.requests || [],
    events: raw?.events || [],
    audit: raw?.audit || [],
    notifications: raw?.notifications || [],
    vins: raw?.vins || [],
    syncLogs: raw?.syncLogs || []
  };
}

export function loadLogistics(): LogisticsState {
  if (typeof localStorage === "undefined") return seedLogistics();
  try { return normalizeLogisticsState(JSON.parse(localStorage.getItem(logisticsLocalKey) || "null") || seedLogistics()); }
  catch { return seedLogistics(); }
}

export function saveLogistics(state: LogisticsState) {
  if (typeof localStorage !== "undefined") localStorage.setItem(logisticsLocalKey, JSON.stringify(normalizeLogisticsState(state)));
}

export function materialName(state: LogisticsState, id?: string | null) {
  return state.materials.find(x => x.id === id)?.nombre || "Sin material";
}

function ensureStock(state: LogisticsState, materialId: string) {
  let row = state.stock.find(x => x.material_id === materialId);
  if (!row) {
    row = { id: uid("stock"), material_id: materialId, cantidad_fisica: 0, cantidad_reservada: 0, cantidad_picking: 0, cantidad_bloqueada: 0 };
    state.stock.push(row);
  }
  return row;
}

function assertNonNegative(state: LogisticsState, row: Stock, materialId: string) {
  if (available(row) < 0 || row.cantidad_fisica < 0 || row.cantidad_reservada < 0 || row.cantidad_picking < 0 || row.cantidad_bloqueada < 0) {
    throw new Error(`Stock insuficiente para ${materialName(state, materialId)}`);
  }
}

export function createMovement(state: LogisticsState, movement: Omit<StockMovement, "id" | "created_at">) {
  const row = ensureStock(state, movement.material_id);
  if (["entrada", "devolucion"].includes(movement.tipo)) row.cantidad_fisica += movement.cantidad;
  if (["danio", "perdida", "salida"].includes(movement.tipo)) row.cantidad_fisica -= movement.cantidad;
  if (movement.tipo === "reserva") row.cantidad_reservada += movement.cantidad;
  if (movement.tipo === "liberacion") row.cantidad_reservada -= movement.cantidad;
  if (movement.tipo === "picking") { row.cantidad_reservada -= movement.cantidad; row.cantidad_picking += movement.cantidad; }
  if (["entrega", "consumo"].includes(movement.tipo)) { row.cantidad_picking -= movement.cantidad; row.cantidad_fisica -= movement.cantidad; }
  if (movement.tipo === "ajuste") row.cantidad_fisica += movement.cantidad;
  assertNonNegative(state, row, movement.material_id);
  state.movements.unshift({ ...movement, id: uid("mov"), created_at: new Date().toISOString() });
}

export function upsertMaterialCatalog(state: LogisticsState, input: Partial<Material> & { sku: string; nombre: string; cliente_id?: string | null }) {
  const existing = state.materials.find(x => x.sku.toLowerCase() === input.sku.toLowerCase() && (x.cliente_id || null) === (input.cliente_id || null));
  const previous = existing ? { ...existing } : null;
  const material: Material = {
    id: existing?.id || uid("mat"), sku: input.sku, nombre: input.nombre,
    cliente_id: input.cliente_id ?? existing?.cliente_id ?? null,
    tipo: input.tipo || existing?.tipo || "consumible",
    medidas: input.medidas ?? existing?.medidas ?? null,
    unidad_control: input.unidad_control || existing?.unidad_control || "uds",
    stock_minimo: Number(input.stock_minimo ?? existing?.stock_minimo ?? 0),
    stock_objetivo: Number(input.stock_objetivo ?? existing?.stock_objetivo ?? 0),
    proveedor_id: input.proveedor_id ?? existing?.proveedor_id ?? null,
    coste: input.coste ?? existing?.coste ?? null,
    activo: input.activo ?? existing?.activo ?? true
  };
  if (existing) Object.assign(existing, material); else { state.materials.unshift(material); ensureStock(state, material.id); }
  return { material, created: !existing, previous };
}

export function upsertLogisticsVin(state: LogisticsState, input: Omit<Partial<LogisticsVin>, "id" | "created_at" | "updated_at"> & { vin_id: string }) {
  const now = new Date().toISOString();
  const existing = state.vins.find(x => x.vin_id === input.vin_id);
  const next: LogisticsVin = {
    id: existing?.id || uid("vin"), vin_id: input.vin_id,
    material_id: input.material_id ?? existing?.material_id ?? null,
    campana_id: input.campana_id ?? existing?.campana_id ?? null,
    farmacia_id: input.farmacia_id ?? existing?.farmacia_id ?? null,
    farmacia_nombre: input.farmacia_nombre ?? existing?.farmacia_nombre ?? null,
    direccion: input.direccion ?? existing?.direccion ?? null,
    telefono: input.telefono ?? existing?.telefono ?? null,
    responsable: input.responsable ?? existing?.responsable ?? null,
    instalador_id: input.instalador_id ?? existing?.instalador_id ?? null,
    instalador_nombre: input.instalador_nombre ?? existing?.instalador_nombre ?? null,
    medidas: input.medidas ?? existing?.medidas ?? null,
    estado: input.estado || existing?.estado || "pendiente_picking",
    picking_id: input.picking_id ?? existing?.picking_id ?? null,
    shipment_id: input.shipment_id ?? existing?.shipment_id ?? null,
    incident_id: input.incident_id ?? existing?.incident_id ?? null,
    pending_arrival_id: input.pending_arrival_id ?? existing?.pending_arrival_id ?? null,
    created_at: existing?.created_at || now,
    updated_at: now
  };
  if (existing) Object.assign(existing, next); else state.vins.unshift(next);
  return next;
}

export function addSyncLog(state: LogisticsState, entry: Omit<SyncLogEntry, "id" | "created_at">) {
  state.syncLogs.unshift({ ...entry, id: uid("sync"), created_at: new Date().toISOString() });
}

export function createIncident(state: LogisticsState, data: Omit<Incident, "id" | "codigo" | "fecha_deteccion" | "estado"> & { estado?: IncidentStatus }) {
  const inc: Incident = { ...data, id: uid("inc"), codigo: `INC-${new Date().getFullYear()}-${String(state.incidents.length + 1).padStart(4, "0")}`, fecha_deteccion: today(), estado: data.estado || "nueva" };
  state.incidents.unshift(inc);
  if (inc.vin_id) upsertLogisticsVin(state, { vin_id: inc.vin_id, estado: "con_incidencia", incident_id: inc.id });
  return inc;
}

export function createPicking(state: LogisticsState, data: { instalador_id?: string | null; campana_id?: string | null; zona?: string | null; fecha_salida_prevista?: string | null; num_puntos: number; lineas: Array<{ material_id: string; vin_id?: string | null; cantidad_esperada: number }> }) {
  const picking: Picking = { id: uid("pick"), codigo: `PICK-${new Date().getFullYear()}-${String(state.pickings.length + 1).padStart(4, "0")}`, estado: "pendiente", instalador_id: data.instalador_id, campana_id: data.campana_id, zona: data.zona, fecha_salida_prevista: data.fecha_salida_prevista, num_puntos: data.num_puntos, lineas: [] };
  picking.lineas = data.lineas.map(line => ({ ...line, id: uid("pline"), picking_id: picking.id, cantidad_preparada: 0, estado: "pendiente" }));
  picking.lineas.forEach(line => createMovement(state, { material_id: line.material_id, tipo: "reserva", cantidad: line.cantidad_esperada, campana_id: picking.campana_id, vin_id: line.vin_id, motivo: `Reserva ${picking.codigo}` }));
  state.pickings.unshift(picking);
  return picking;
}

export function createPickingFromRequest(state: LogisticsState, requestId: string, actor = "Logística") {
  const request = state.requests.find(x => x.id === requestId);
  if (!request) throw new Error("Solicitud no encontrada");
  if (request.picking_id) return state.pickings.find(x => x.id === request.picking_id) || null;
  const lines = request.lines.map(line => {
    const req = state.requirements.find(x => x.id === line.material_requirement_id);
    const materialId = line.material_id || req?.material_id;
    if (!materialId) throw new Error("La solicitud contiene líneas sin material vinculado.");
    return { material_id: materialId, vin_id: req?.vin || null, cantidad_esperada: Math.max(1, Number(line.accepted_quantity || line.requested_quantity || 1)) };
  });
  const picking = createPicking(state, { instalador_id: request.installer_id || null, campana_id: request.campaign_id || null, zona: request.province || request.city || "", fecha_salida_prevista: request.required_date || today(), num_puntos: 1, lineas: lines });
  request.picking_id = picking.id;
  request.status = "en_preparacion";
  request.updated_at = new Date().toISOString();
  request.lines.forEach(line => { line.line_status = "en_picking"; if (!line.accepted_quantity) line.accepted_quantity = line.requested_quantity; });
  state.requirements.filter(req => req.request_id === request.id).forEach(req => { req.picking_id = picking.id; req.status = "en_picking"; req.updated_at = request.updated_at; if (req.vin) upsertLogisticsVin(state, { vin_id: req.vin, estado: "en_picking", picking_id: picking.id }); });
  addSyncLog(state, { evento: "logistica.picking_creado", origen_modulo: "logistica", destino_modulo: "servicios_isdin", entidad_id: picking.id, usuario_id: actor, payload: { request_id: request.id, picking_id: picking.id }, resultado: "ok" });
  return picking;
}

export function rejectLogisticsRequest(state: LogisticsState, requestId: string, reason: string, actor = "Logística") {
  const request = state.requests.find(x => x.id === requestId);
  if (!request) throw new Error("Solicitud no encontrada");
  request.status = "rechazada";
  request.rejection_reason = reason;
  request.updated_at = new Date().toISOString();
  request.lines.forEach(line => line.line_status = "cancelada");
  addSyncLog(state, { evento: "logistica.peticion_rechazada", origen_modulo: "logistica", destino_modulo: "servicios_isdin", entidad_id: request.id, usuario_id: actor, payload: { reason }, resultado: "ok" });
}

export function logisticsKpis(state: LogisticsState) {
  const openIncidents = state.incidents.filter(x => !["resuelta", "cancelada"].includes(x.estado));
  const openRequests = state.requests.filter(x => !["cerrada", "cancelada", "rechazada"].includes(x.status));
  return {
    pendingEntries: state.entries.filter(x => x.estado === "pendiente").length,
    entriesToday: state.entries.filter(x => x.fecha_recepcion === today()).length,
    pendingPickings: state.pickings.filter(x => ["pendiente", "en_preparacion"].includes(x.estado)).length,
    openIncidents: openIncidents.length,
    unconfirmedShipments: state.shipments.filter(x => !x.confirmado_por_instalador && !["fallido", "extraviado", "devuelto"].includes(x.estado)).length,
    lowStock: state.stock.filter(s => available(s) < (state.materials.find(m => m.id === s.material_id)?.stock_minimo || 0)).length,
    blockedInstalls: openIncidents.filter(x => x.vin_id || x.campana_id).length,
    preparedPickings: state.pickings.filter(x => x.estado === "preparado").length,
    openRequirements: state.requirements.filter(x => !["cancelada", "consumida", "entregada"].includes(x.status)).length,
    openRequests: openRequests.length,
    syncErrors: state.events.filter(x => x.status === "error").length
  };
}

export function logisticsAlerts(state: LogisticsState) {
  const alerts: { level: "critica" | "alta" | "info"; text: string; href: string }[] = [];
  state.stock.forEach(s => {
    const m = state.materials.find(x => x.id === s.material_id);
    if (m && available(s) < m.stock_minimo) alerts.push({ level: "alta", text: `${m.nombre} bajo mínimo`, href: `/inventario?id=${s.material_id}` });
  });
  state.events.filter(x => x.status === "error").forEach(event => alerts.push({ level: "critica", text: `Error de sincronización: ${event.event_type}`, href: "/sincronizacion" }));
  state.requirements.filter(x => ["pendiente_stock", "pendiente_recepcion", "bloqueada", "con_incidencia"].includes(x.status)).forEach(r => alerts.push({ level: r.priority === "critica" ? "critica" : "alta", text: `${r.requested_material_name}: ${logisticsStatusLabel(r.status)}`, href: `/solicitudes?id=${r.request_id || r.id}` }));
  return alerts;
}

export function logisticsStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    pendiente_revision: "Solicitud logística enviada", aceptada: "Solicitud aceptada", pendiente_stock: "Pendiente de stock", pendiente_produccion: "Material en producción", pendiente_recepcion: "Material pendiente de llegada", parcialmente_disponible: "Parcialmente disponible", disponible: "Material disponible", reservada: "Material reservado", en_picking: "Picking en preparación", preparada: "Picking preparado", enviada: "Material enviado", entregada: "Material entregado", consumida: "Material consumido", cancelada: "Solicitud cancelada", bloqueada: "Instalación bloqueada por Logística", con_incidencia: "Incidencia logística"
  };
  return labels[String(status || "")] || "Sin estado logístico";
}
