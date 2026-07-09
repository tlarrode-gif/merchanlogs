/**
 * Datos operativos semilla: entradas, movimientos, peticiones, envios e
 * incidencias. Referencian por id a clientes, campanas, servicios y materiales.
 */

import {
  Incident,
  LogisticsRequest,
  RequestHistoryEntry,
  Shipment,
  StockEntry,
  StockMovement
} from "@/types";
import { seedBase, SEED_NOW } from "@/data/_helpers";

export const stockEntries: StockEntry[] = [
  {
    id: "ent_0001",
    clientId: "cli_isdin",
    campaignId: "cmp_isdin_vinilos",
    materialId: "mat_isdin_vinilo_a",
    quantity: 12,
    entryDate: "2026-06-20T00:00:00.000Z",
    supplier: "Imprenta GranFormato SL",
    deliveryNote: "ALB-2026-1123",
    receivedBy: "almacen_1",
    status: "recibida",
    notes: "Recepcion completa. Vinilos verificados.",
    ...seedBase({ createdBy: "almacen_1" })
  },
  {
    id: "ent_0002",
    clientId: "cli_nestle",
    campaignId: "cmp_nestle_pdv",
    materialId: "mat_nestle_display",
    quantity: 25,
    entryDate: "2026-06-25T00:00:00.000Z",
    supplier: "Displays Iberia",
    deliveryNote: "ALB-2026-2001",
    receivedBy: "almacen_1",
    status: "recibida",
    notes: null,
    ...seedBase({ createdBy: "almacen_1" })
  },
  {
    id: "ent_0003",
    clientId: "cli_sabadell",
    campaignId: "cmp_sabadell_oficinas",
    materialId: "mat_sabadell_carteleria",
    quantity: 5,
    entryDate: "2026-07-05T00:00:00.000Z",
    supplier: "Rotulos BCN",
    deliveryNote: null,
    receivedBy: null,
    status: "pendiente_revision",
    notes: "Pendiente de revisar antes de dar entrada al stock.",
    ...seedBase({ createdBy: "almacen_1" })
  }
];

export const stockMovements: StockMovement[] = [
  {
    id: "mov_0001",
    materialId: "mat_isdin_vinilo_a",
    clientId: "cli_isdin",
    campaignId: "cmp_isdin_vinilos",
    type: "entrada",
    quantity: 12,
    fromLocation: null,
    toLocation: "almacen",
    reason: "Entrada ent_0001 (albaran ALB-2026-1123)",
    relatedEntityType: "entrada",
    relatedEntityId: "ent_0001",
    ...seedBase({ createdBy: "almacen_1", createdAt: "2026-06-20T09:00:00.000Z", updatedAt: "2026-06-20T09:00:00.000Z" })
  },
  {
    id: "mov_0002",
    materialId: "mat_nestle_display",
    clientId: "cli_nestle",
    campaignId: "cmp_nestle_pdv",
    type: "entrada",
    quantity: 25,
    fromLocation: null,
    toLocation: "almacen",
    reason: "Entrada ent_0002 (albaran ALB-2026-2001)",
    relatedEntityType: "entrada",
    relatedEntityId: "ent_0002",
    ...seedBase({ createdBy: "almacen_1", createdAt: "2026-06-25T10:30:00.000Z", updatedAt: "2026-06-25T10:30:00.000Z" })
  }
];

export const logisticsRequests: LogisticsRequest[] = [
  {
    id: "req_0001",
    requestCode: "PET-2026-0001",
    clientId: "cli_isdin",
    campaignId: "cmp_isdin_vinilos",
    serviceId: "srv_isdin_bcn_001",
    requestedBy: "gestor_1",
    assignedTo: "almacen_1",
    priority: "alta",
    status: "preparando",
    requestedDate: "2026-07-02T00:00:00.000Z",
    neededByDate: "2026-07-12T00:00:00.000Z",
    materials: [
      { materialId: "mat_isdin_vinilo_a", quantity: 2, preparedQuantity: 1, notes: "Escaparate" },
      { materialId: "mat_isdin_vinilo_b", quantity: 1, preparedQuantity: 0, notes: "Mostrador (pendiente produccion)" }
    ],
    destination: "Farmacia Diagonal, Barcelona",
    notes: "Instalacion semana W29.",
    ...seedBase({ createdBy: "gestor_1", merchanOpsId: "merchanops_request_isdin_0001", sourceSystem: "merchanops" })
  },
  {
    id: "req_0002",
    requestCode: "PET-2026-0002",
    clientId: "cli_nestle",
    campaignId: "cmp_nestle_pdv",
    serviceId: "srv_nestle_001",
    requestedBy: "gestor_1",
    assignedTo: "almacen_1",
    priority: "normal",
    status: "lista_para_envio",
    requestedDate: "2026-06-28T00:00:00.000Z",
    neededByDate: "2026-07-09T00:00:00.000Z",
    materials: [{ materialId: "mat_nestle_display", quantity: 4, preparedQuantity: 4, notes: null }],
    destination: "Supermercado Sants, Barcelona",
    notes: null,
    ...seedBase({ createdBy: "gestor_1" })
  },
  {
    id: "req_0003",
    requestCode: "PET-2026-0003",
    clientId: "cli_revlon",
    campaignId: "cmp_revlon_material",
    serviceId: null,
    requestedBy: "gestor_1",
    assignedTo: null,
    priority: "normal",
    status: "solicitada",
    requestedDate: "2026-07-06T00:00:00.000Z",
    neededByDate: "2026-07-20T00:00:00.000Z",
    materials: [{ materialId: "mat_revlon_display", quantity: 5, preparedQuantity: 0, notes: null }],
    destination: "Almacen central",
    notes: "Revisar stock, actualmente bajo minimo.",
    ...seedBase({ createdBy: "gestor_1" })
  }
];

export const requestHistory: RequestHistoryEntry[] = [
  {
    id: "rqh_0001",
    requestId: "req_0001",
    fromStatus: null,
    toStatus: "solicitada",
    note: "Peticion creada",
    ...seedBase({ createdBy: "gestor_1", createdAt: "2026-07-02T08:00:00.000Z", updatedAt: "2026-07-02T08:00:00.000Z" })
  },
  {
    id: "rqh_0002",
    requestId: "req_0001",
    fromStatus: "solicitada",
    toStatus: "preparando",
    note: "Inicio de preparacion",
    ...seedBase({ createdBy: "almacen_1", createdAt: "2026-07-03T09:00:00.000Z", updatedAt: "2026-07-03T09:00:00.000Z" })
  }
];

export const shipments: Shipment[] = [
  {
    id: "shp_0001",
    shipmentCode: "ENV-2026-0001",
    logisticsRequestId: "req_0002",
    clientId: "cli_nestle",
    campaignId: "cmp_nestle_pdv",
    carrier: "Nacex",
    trackingNumber: null,
    shippingDate: null,
    estimatedDeliveryDate: "2026-07-08T00:00:00.000Z",
    deliveryDate: null,
    status: "preparado",
    destination: "Supermercado Sants, Barcelona",
    notes: "Preparado para recogida. Tracking pendiente (integracion transportista futura).",
    ...seedBase({ createdBy: "almacen_1" })
  }
];

export const incidents: Incident[] = [
  {
    id: "inc_0001",
    incidentCode: "INC-2026-0001",
    title: "Medidas del vinilo de mostrador incorrectas",
    description: "El vinilo B no encaja en el mostrador de Farmacia Diagonal. Requiere reproduccion.",
    clientId: "cli_isdin",
    campaignId: "cmp_isdin_vinilos",
    serviceId: "srv_isdin_bcn_001",
    pointOfSaleName: "Farmacia Diagonal",
    materialId: "mat_isdin_vinilo_b",
    shipmentId: null,
    logisticsRequestId: "req_0001",
    stockEntryId: null,
    type: "medidas_incorrectas",
    severity: "alta",
    status: "abierta",
    assignedTo: "almacen_1",
    resolvedAt: null,
    resolutionNotes: null,
    ...seedBase({ createdBy: "gestor_1", merchanOpsId: null, sourceSystem: "merchanops" })
  },
  {
    id: "inc_0002",
    incidentCode: "INC-2026-0002",
    title: "Stock de display Revlon por debajo del minimo",
    description: "Solo quedan 3 unidades de display Revlon (minimo 10). Reponer.",
    clientId: "cli_revlon",
    campaignId: "cmp_revlon_material",
    serviceId: null,
    pointOfSaleName: null,
    materialId: "mat_revlon_display",
    shipmentId: null,
    logisticsRequestId: "req_0003",
    stockEntryId: null,
    type: "error_stock",
    severity: "media",
    status: "en_revision",
    assignedTo: "almacen_1",
    resolvedAt: null,
    resolutionNotes: null,
    ...seedBase({ createdBy: "almacen_1" })
  }
];

// Referencia al momento semilla por si algun consumidor lo necesita.
export const seededAt = SEED_NOW;
