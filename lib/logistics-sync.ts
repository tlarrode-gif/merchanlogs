import { IntegrationEvent, LogisticsNotification, LogisticsRequest, LogisticsRequestLine, LogisticsState, MaterialRequirement, RequirementSourceType, addSyncLog, available, logisticsStatusLabel, materialName, today, uid, upsertLogisticsVin } from "@/lib/logistics";

export function ensureIntegrationEvent(state: LogisticsState, eventType: string, sourceType: string, sourceId: string, payload: Record<string, unknown>, eventVersion = "v1") {
  const idempotency = `${eventType}:${sourceType}:${sourceId}:${eventVersion}`;
  const existing = state.events.find(event => event.idempotency_key === idempotency);
  if (existing) return existing;
  const event: IntegrationEvent = { id: uid("evt"), event_type: eventType, source_type: sourceType, source_id: sourceId, idempotency_key: idempotency, payload, status: "pendiente", attempts: 0, created_at: new Date().toISOString() };
  state.events.unshift(event);
  return event;
}

export function failEvent(state: LogisticsState, eventId: string, error: unknown) {
  const row = state.events.find(event => event.id === eventId);
  if (!row) return;
  row.status = "error";
  row.attempts += 1;
  row.last_error = error instanceof Error ? error.message : String(error);
}

export function notify(state: LogisticsState, input: Omit<LogisticsNotification, "id" | "read" | "resolved" | "created_at">) {
  state.notifications.unshift({ ...input, id: uid("not"), read: false, resolved: false, created_at: new Date().toISOString() });
}

export function createServiceLogisticsRequest(state: LogisticsState, service: Record<string, unknown>, materials: Array<Record<string, unknown>> = [], eventVersion = "v1") {
  const sourceType = normalizeSourceType(service.source_type) || "service";
  const sourceId = text(service.service_point_id || service.point_id || service.service_id || service.id || uid("src"));
  ensureIntegrationEvent(state, "servicio.peticion_material_creada", sourceType, sourceId, { service, materials }, eventVersion);
  const request: LogisticsRequest = {
    id: uid("req"),
    code: `SOL-${new Date().getFullYear()}-${String(state.requests.length + 1).padStart(4, "0")}`,
    source_type: sourceType,
    source_id: sourceId,
    client_id: text(service.client_id || service.cliente_id || service.customer_id) || null,
    campaign_id: text(service.campaign_id || service.campana_id) || null,
    service_id: text(service.service_id || service.id) || null,
    requested_by: text(service.requested_by || service.solicitante) || "MerchanOPS",
    requested_at: new Date().toISOString(),
    required_date: text(service.required_date || service.fecha_necesidad || service.installation_date) || null,
    installation_date: text(service.installation_date || service.fecha_instalacion) || null,
    priority: priority(service.priority || service.urgencia),
    destination_type: "instalador",
    installer_id: text(service.installer_id || service.instalador_id) || null,
    installer_name: text(service.installer_name || service.instalador_nombre) || null,
    delivery_address: text(service.delivery_address || service.direccion) || null,
    province: text(service.province || service.provincia) || null,
    city: text(service.city || service.ciudad) || null,
    status: "pendiente_revision",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lines: [],
    source_system: "MerchanOPS",
    sync_event_id: eventVersion,
    requires_review: false
  };
  const normalizedMaterials = materials.length ? materials : [{ requested_material_name: text(service.material_name || service.material || service.vin || "Material solicitado"), requested_quantity: Number(service.quantity || service.cantidad || 1), requested_sku: text(service.sku || service.vin) }];
  normalizedMaterials.forEach(item => {
    const materialId = text(item.material_id) || state.materials.find(material => material.sku === text(item.sku || item.requested_sku))?.id || null;
    const requirement: MaterialRequirement = {
      id: uid("reqmat"), source_type: sourceType, source_id: sourceId,
      client_id: request.client_id, campaign_id: request.campaign_id, service_id: request.service_id, service_point_id: text(service.service_point_id || service.point_id) || null,
      isdin_vinyl_id: text(service.isdin_vinyl_id || service.vinyl_id) || null,
      vin: text(item.vin || service.vin) || null,
      pharmacy_id: text(service.pharmacy_id || service.farmacia_id) || null,
      pharmacy_name: text(service.pharmacy_name || service.farmacia_nombre) || null,
      material_id: materialId,
      requested_material_name: text(item.requested_material_name || item.nombre || item.name || service.material_name || "Material solicitado"),
      requested_sku: text(item.requested_sku || item.sku || service.sku) || null,
      material_type: "vinilo_medida",
      requested_quantity: Number(item.requested_quantity || item.cantidad || 1),
      unit: "uds",
      required_date: request.required_date,
      installation_date: request.installation_date,
      province: request.province,
      city: request.city,
      delivery_address: request.delivery_address,
      installer_id: request.installer_id,
      installer_name: request.installer_name,
      priority: request.priority,
      status: "pendiente_revision",
      created_at: request.created_at,
      updated_at: request.updated_at,
      request_id: request.id,
      source_system: "MerchanOPS",
      sync_event_id: eventVersion
    };
    const line: LogisticsRequestLine = { id: uid("reql"), request_id: request.id, material_requirement_id: requirement.id, material_id: materialId, requested_quantity: requirement.requested_quantity, accepted_quantity: 0, prepared_quantity: 0, delivered_quantity: 0, missing_quantity: requirement.requested_quantity, line_status: requirement.status };
    state.requirements.unshift(requirement);
    request.lines.push(line);
    if (requirement.vin) upsertLogisticsVin(state, { vin_id: requirement.vin, material_id: materialId, campana_id: request.campaign_id, farmacia_id: requirement.pharmacy_id, farmacia_nombre: requirement.pharmacy_name, direccion: request.delivery_address, instalador_id: request.installer_id, instalador_nombre: request.installer_name, estado: "pendiente_picking" });
  });
  state.requests.unshift(request);
  addSyncLog(state, { evento: "servicio.peticion_material_creada", origen_modulo: "servicios", destino_modulo: "logistica", entidad_id: request.id, payload: { request_id: request.id }, resultado: "ok" });
  return request;
}

export function syncIsdinVinylToLogistics(state: LogisticsState, vinyl: Record<string, unknown>, eventVersion = "v1") {
  const vin = text(vinyl.vin || vinyl.vin_id || vinyl.id);
  if (!vin) throw new Error("VIN no informado");
  ensureIntegrationEvent(state, "isdin_vinyl.updated", "isdin_vinyl", vin, vinyl, eventVersion);
  upsertLogisticsVin(state, { vin_id: vin, campana_id: text(vinyl.campana_id || vinyl.campaign_id) || null, farmacia_id: text(vinyl.farmacia_id || vinyl.pharmacy_id) || null, farmacia_nombre: text(vinyl.farmacia_nombre || vinyl.pharmacy_name) || null, direccion: text(vinyl.direccion || vinyl.address) || null, telefono: text(vinyl.telefono || vinyl.phone) || null, instalador_id: text(vinyl.instalador_id || vinyl.installer_id) || null, instalador_nombre: text(vinyl.instalador_nombre || vinyl.installer_name) || null, medidas: text(vinyl.medidas || vinyl.measures) || null, estado: "pendiente_picking" });
}

export function syncInstallerChange(state: LogisticsState, sourceType: RequirementSourceType, sourceId: string, data: { installer_id?: string | null; installer_name?: string | null; delivery_address?: string | null }, actor = "Operaciones") {
  state.requirements.filter(req => req.source_type === sourceType && req.source_id === sourceId).forEach(req => {
    req.installer_id = data.installer_id || req.installer_id;
    req.installer_name = data.installer_name || req.installer_name;
    req.delivery_address = data.delivery_address || req.delivery_address;
    req.updated_at = new Date().toISOString();
  });
  state.requests.filter(req => req.source_type === sourceType && req.source_id === sourceId).forEach(req => {
    req.installer_id = data.installer_id || req.installer_id;
    req.installer_name = data.installer_name || req.installer_name;
    req.delivery_address = data.delivery_address || req.delivery_address;
    req.updated_at = new Date().toISOString();
  });
  addSyncLog(state, { evento: "servicio.instalador_cambiado", origen_modulo: "servicios", destino_modulo: "logistica", entidad_id: sourceId, usuario_id: actor, payload: data as Record<string, unknown>, resultado: "ok" });
}

export function acceptRequestAndReserve(state: LogisticsState, requestId: string, actor = "Logística") {
  const request = state.requests.find(row => row.id === requestId);
  if (!request) throw new Error("Solicitud no encontrada");
  request.status = "aceptada";
  request.accepted_by = actor;
  request.accepted_at = new Date().toISOString();
  request.updated_at = request.accepted_at;
  request.lines.forEach(line => {
    const req = state.requirements.find(item => item.id === line.material_requirement_id);
    const materialId = line.material_id || req?.material_id;
    const stock = materialId ? state.stock.find(row => row.material_id === materialId) : null;
    const qty = Number(line.requested_quantity || req?.requested_quantity || 1);
    line.accepted_quantity = qty;
    line.missing_quantity = 0;
    line.line_status = materialId && available(stock) >= qty ? "reservada" : "pendiente_stock";
    if (req) {
      req.status = line.line_status;
      req.reserved_quantity = line.line_status === "reservada" ? qty : 0;
      req.updated_at = request.updated_at;
    }
  });
  addSyncLog(state, { evento: "logistica.peticion_aprobada", origen_modulo: "logistica", destino_modulo: "servicios_isdin", entidad_id: request.id, usuario_id: actor, payload: { request_id: request.id }, resultado: "ok" });
}

export function logisticsSummaryForSource(state: LogisticsState, sourceType: RequirementSourceType, sourceId: string) {
  const requirements = state.requirements.filter(req => req.source_type === sourceType && req.source_id === sourceId);
  const request = state.requests.find(req => req.source_type === sourceType && req.source_id === sourceId) || (requirements[0]?.request_id ? state.requests.find(req => req.id === requirements[0].request_id) : null);
  const picking = request?.picking_id ? state.pickings.find(row => row.id === request.picking_id) || null : null;
  const shipment = request?.shipment_id ? state.shipments.find(row => row.id === request.shipment_id) || null : picking?.envio_id ? state.shipments.find(row => row.id === picking.envio_id) || null : null;
  const incident = requirements.map(req => req.incident_id ? state.incidents.find(row => row.id === req.incident_id) : null).find(Boolean) || null;
  const pending = requirements.map(req => req.pending_arrival_id ? state.pendings.find(row => row.id === req.pending_arrival_id) : null).find(Boolean) || null;
  const label = request?.status ? logisticsStatusLabel(request.status) : logisticsStatusLabel(requirements[0]?.status);
  return { requirements, request, picking, shipment, incident, pending, label };
}

export function materialDisplay(req: MaterialRequirement, state: LogisticsState) {
  return req.material_id ? materialName(state, req.material_id) : req.requested_material_name || req.requested_sku || "Material solicitado";
}

export function sourceHref(req: LogisticsRequest) {
  const opsUrl = String(process.env.NEXT_PUBLIC_MERCHANOPS_URL || "").replace(/\/$/, "");
  if (req.source_type === "isdin_vinyl") return `${opsUrl}/grandes-campanas/isdin?vin=${encodeURIComponent(req.source_id)}`;
  if (req.source_type === "service" || req.source_type === "service_point") return `${opsUrl}/?tab=servicios&service=${encodeURIComponent(req.service_id || req.source_id)}`;
  return opsUrl || "/";
}

export function detectLogisticsSyncIssues(state: LogisticsState) {
  const issues: Array<{ id: string; severity: "critica" | "alta" | "info"; text: string; fix?: string }> = [];
  state.events.filter(event => event.status === "error").forEach(event => issues.push({ id: event.id, severity: "critica", text: `${event.event_type} falló`, fix: event.last_error || "Reintentar evento o revisar payload." }));
  state.requests.filter(request => request.status !== "rechazada" && !request.lines.length).forEach(request => issues.push({ id: request.id, severity: "alta", text: `${request.code} no tiene líneas`, fix: "Añadir líneas de material o rechazar la solicitud." }));
  state.requirements.filter(req => req.status === "pendiente_stock" && req.material_id).forEach(req => issues.push({ id: req.id, severity: req.priority === "critica" ? "critica" : "alta", text: `${req.requested_material_name} sin stock disponible`, fix: "Registrar entrada, sustitución o producción." }));
  return issues;
}

function normalizeSourceType(value: unknown): RequirementSourceType | null {
  const raw = text(value);
  const allowed = ["service", "service_point", "isdin_vinyl", "campaign", "incident", "replacement", "manual_request"];
  return allowed.includes(raw) ? raw as RequirementSourceType : null;
}

function priority(value: unknown) {
  const raw = text(value);
  return raw === "critica" || raw === "alta" || raw === "media" || raw === "baja" ? raw : "media";
}

function text(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}
