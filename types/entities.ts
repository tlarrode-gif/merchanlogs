/**
 * Entidades del dominio logistico de MerchanLOGS.
 *
 * Cada entidad extiende BaseEntity (id + campos de sincronizacion). Las
 * relaciones se modelan por id (clientId, campaignId, ...) para que el mapeo a
 * tablas relacionales de Supabase sea directo.
 */

import { BaseEntity, ISODateString } from "@/types/base";
import {
  CampaignStatus,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  LogisticsRequestStatus,
  MaterialStatus,
  MaterialType,
  PointOfSaleType,
  Priority,
  RelatedEntityType,
  Role,
  ServiceLogisticsStatus,
  ShipmentStatus,
  StockEntryStatus,
  StockMovementType
} from "@/types/enums";

// ---------------------------------------------------------------------------
// Usuarios y roles
// ---------------------------------------------------------------------------

/**
 * Usuario interno. En el futuro los usuarios de rol "gestor" seran los mismos
 * que existen en MerchanOPS (Supabase Auth), por eso se mantiene `merchanOpsId`
 * y `externalId` desde BaseEntity para poder mapearlos.
 */
export interface User extends BaseEntity {
  username: string;
  displayName: string;
  email?: string | null;
  role: Role;
  active: boolean;
  /** Provincias asignadas (para gestores), preparado para filtrado por ambito. */
  provinces: string[];
}

// ---------------------------------------------------------------------------
// Clientes / CECOs
// ---------------------------------------------------------------------------

export interface Client extends BaseEntity {
  name: string;
  /** Codigo o CECO del cliente. */
  ceco: string;
  description?: string | null;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Campanas
// ---------------------------------------------------------------------------

export interface Campaign extends BaseEntity {
  clientId: string;
  /** CECO desnormalizado para facilitar reporting/importacion. */
  ceco?: string | null;
  campaignName: string;
  description?: string | null;
  startDate?: ISODateString | null;
  endDate?: ISODateString | null;
  status: CampaignStatus;
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

export interface Service extends BaseEntity {
  clientId: string;
  campaignId?: string | null;
  serviceName: string;
  serviceCode: string;
  pointOfSaleName?: string | null;
  pointOfSaleType?: PointOfSaleType | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  scheduledDate?: ISODateString | null;
  /** Semana de instalacion (uso ISDIN/vinilos). */
  installationWeek?: string | null;
  logisticsStatus: ServiceLogisticsStatus;
  /** Ids de materiales requeridos por el servicio. */
  materialsRequired: string[];
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Materiales
// ---------------------------------------------------------------------------

export interface Material extends BaseEntity {
  clientId: string;
  campaignId?: string | null;
  name: string;
  materialCode: string;
  type: MaterialType;
  description?: string | null;
  /** Dimensiones libres (ej. "100x50 cm"). */
  dimensions?: string | null;
  /** Alto en cm (uso ISDIN/vinilos a medida). */
  heightCm?: number | null;
  /** Ancho en cm (uso ISDIN/vinilos a medida). */
  widthCm?: number | null;
  unit: string;
  currentStock: number;
  minimumStock: number;
  location?: string | null;
  status: MaterialStatus;
}

// ---------------------------------------------------------------------------
// Entradas de material
// ---------------------------------------------------------------------------

export interface StockEntry extends BaseEntity {
  clientId: string;
  campaignId?: string | null;
  materialId: string;
  quantity: number;
  entryDate: ISODateString;
  supplier?: string | null;
  deliveryNote?: string | null;
  receivedBy?: string | null;
  status: StockEntryStatus;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Movimientos de stock
// ---------------------------------------------------------------------------

export interface StockMovement extends BaseEntity {
  materialId: string;
  clientId?: string | null;
  campaignId?: string | null;
  type: StockMovementType;
  quantity: number;
  fromLocation?: string | null;
  toLocation?: string | null;
  reason?: string | null;
  relatedEntityType?: RelatedEntityType | null;
  relatedEntityId?: string | null;
}

// ---------------------------------------------------------------------------
// Peticiones logisticas
// ---------------------------------------------------------------------------

/** Linea de material dentro de una peticion logistica. */
export interface LogisticsRequestLine {
  materialId: string;
  /** Cantidad solicitada. */
  quantity: number;
  /** Cantidad ya preparada (picking). */
  preparedQuantity: number;
  notes?: string | null;
}

export interface LogisticsRequest extends BaseEntity {
  requestCode: string;
  clientId: string;
  campaignId?: string | null;
  serviceId?: string | null;
  requestedBy?: string | null;
  assignedTo?: string | null;
  priority: Priority;
  status: LogisticsRequestStatus;
  requestedDate: ISODateString;
  neededByDate?: ISODateString | null;
  materials: LogisticsRequestLine[];
  destination?: string | null;
  notes?: string | null;
}

/** Entrada del histgrico de cambios de una peticion. */
export interface RequestHistoryEntry extends BaseEntity {
  requestId: string;
  fromStatus?: LogisticsRequestStatus | null;
  toStatus: LogisticsRequestStatus;
  note?: string | null;
}

// ---------------------------------------------------------------------------
// Envios
// ---------------------------------------------------------------------------

export interface Shipment extends BaseEntity {
  shipmentCode: string;
  logisticsRequestId?: string | null;
  clientId?: string | null;
  campaignId?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  shippingDate?: ISODateString | null;
  estimatedDeliveryDate?: ISODateString | null;
  deliveryDate?: ISODateString | null;
  status: ShipmentStatus;
  destination?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

export interface Incident extends BaseEntity {
  incidentCode: string;
  title: string;
  description?: string | null;
  clientId?: string | null;
  campaignId?: string | null;
  serviceId?: string | null;
  pointOfSaleName?: string | null;
  materialId?: string | null;
  shipmentId?: string | null;
  logisticsRequestId?: string | null;
  stockEntryId?: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignedTo?: string | null;
  resolvedAt?: ISODateString | null;
  resolutionNotes?: string | null;
}
