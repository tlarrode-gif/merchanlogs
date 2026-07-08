/**
 * Etiquetas legibles, colores y transiciones permitidas de los estados del
 * dominio. Centralizar esto evita hardcodear textos/estados en la UI y facilita
 * validar cambios de estado en la capa de servicios.
 */

import {
  CampaignStatus,
  GroupingType,
  ImportBatchStatus,
  ImportType,
  IncidentSeverity,
  IncidentStatus,
  LogisticsRequestStatus,
  MaterialItemStatus,
  MaterialStatus,
  PickingBatchStatus,
  PickingLineStatus,
  Priority,
  ServiceLogisticsStatus,
  ShipmentStatus,
  StockEntryStatus,
  StockMovementType
} from "@/types/enums";

/** Tono semantico usado por el badge de la UI. */
export type Tone = "gray" | "blue" | "amber" | "green" | "red" | "purple";

export const toneClasses: Record<Tone, string> = {
  gray: "bg-gray-100 text-gray-700 border-gray-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  green: "bg-green-100 text-green-700 border-green-200",
  red: "bg-red-100 text-red-700 border-red-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200"
};

interface StatusMeta<T extends string> {
  label: string;
  tone: Tone;
  /** Estados a los que se puede transitar. Vacio = estado terminal. */
  next: T[];
}

// ---------------------------------------------------------------------------
// Peticiones logisticas
// ---------------------------------------------------------------------------

export const requestStatusMeta: Record<LogisticsRequestStatus, StatusMeta<LogisticsRequestStatus>> = {
  borrador: { label: "Borrador", tone: "gray", next: ["solicitada", "cancelada"] },
  solicitada: { label: "Solicitada", tone: "blue", next: ["en_revision", "preparando", "cancelada"] },
  en_revision: { label: "En revision", tone: "blue", next: ["preparando", "pendiente_material", "cancelada"] },
  preparando: { label: "Preparando", tone: "amber", next: ["pendiente_material", "lista_para_envio", "incidencia"] },
  pendiente_material: { label: "Pendiente material", tone: "amber", next: ["preparando", "incidencia", "cancelada"] },
  lista_para_envio: { label: "Lista para envio", tone: "purple", next: ["enviada", "incidencia"] },
  enviada: { label: "Enviada", tone: "purple", next: ["entregada", "incidencia"] },
  entregada: { label: "Entregada", tone: "green", next: [] },
  incidencia: { label: "Incidencia", tone: "red", next: ["preparando", "cancelada"] },
  cancelada: { label: "Cancelada", tone: "gray", next: [] }
};

export const priorityMeta: Record<Priority, { label: string; tone: Tone }> = {
  baja: { label: "Baja", tone: "gray" },
  normal: { label: "Normal", tone: "blue" },
  alta: { label: "Alta", tone: "amber" },
  urgente: { label: "Urgente", tone: "red" }
};

// ---------------------------------------------------------------------------
// Envios
// ---------------------------------------------------------------------------

export const shipmentStatusMeta: Record<ShipmentStatus, StatusMeta<ShipmentStatus>> = {
  pendiente: { label: "Pendiente", tone: "gray", next: ["preparado", "cancelado"] },
  preparado: { label: "Preparado", tone: "blue", next: ["enviado", "cancelado"] },
  enviado: { label: "Enviado", tone: "purple", next: ["en_transito", "entregado", "incidencia"] },
  en_transito: { label: "En transito", tone: "purple", next: ["entregado", "incidencia", "devuelto"] },
  entregado: { label: "Entregado", tone: "green", next: [] },
  incidencia: { label: "Incidencia", tone: "red", next: ["en_transito", "devuelto", "cancelado"] },
  devuelto: { label: "Devuelto", tone: "amber", next: [] },
  cancelado: { label: "Cancelado", tone: "gray", next: [] }
};

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

export const incidentStatusMeta: Record<IncidentStatus, StatusMeta<IncidentStatus>> = {
  abierta: { label: "Abierta", tone: "red", next: ["en_revision", "en_curso", "cancelada"] },
  en_revision: { label: "En revision", tone: "amber", next: ["en_curso", "bloqueada", "resuelta", "cancelada"] },
  en_curso: { label: "En curso", tone: "amber", next: ["bloqueada", "resuelta", "cancelada"] },
  bloqueada: { label: "Bloqueada", tone: "red", next: ["en_curso", "cancelada"] },
  resuelta: { label: "Resuelta", tone: "green", next: [] },
  cancelada: { label: "Cancelada", tone: "gray", next: [] }
};

export const incidentSeverityMeta: Record<IncidentSeverity, { label: string; tone: Tone }> = {
  baja: { label: "Baja", tone: "gray" },
  media: { label: "Media", tone: "blue" },
  alta: { label: "Alta", tone: "amber" },
  critica: { label: "Critica", tone: "red" }
};

/** Estados de incidencia que se consideran "abiertas" (para KPIs). */
export const openIncidentStatuses: IncidentStatus[] = ["abierta", "en_revision", "en_curso", "bloqueada"];

// ---------------------------------------------------------------------------
// Entradas de material
// ---------------------------------------------------------------------------

export const stockEntryStatusMeta: Record<StockEntryStatus, StatusMeta<StockEntryStatus>> = {
  pendiente_revision: { label: "Pendiente revision", tone: "amber", next: ["recibida", "parcialmente_recibida", "rechazada", "incidencia"] },
  recibida: { label: "Recibida", tone: "green", next: ["incidencia"] },
  parcialmente_recibida: { label: "Parcialmente recibida", tone: "amber", next: ["recibida", "incidencia"] },
  rechazada: { label: "Rechazada", tone: "red", next: [] },
  incidencia: { label: "Incidencia", tone: "red", next: ["recibida", "rechazada"] }
};

/** Estados de entrada que provocan actualizacion de stock al aplicarse. */
export const stockAddingEntryStatuses: StockEntryStatus[] = ["recibida", "parcialmente_recibida"];

// ---------------------------------------------------------------------------
// Campanas
// ---------------------------------------------------------------------------

export const campaignStatusMeta: Record<CampaignStatus, { label: string; tone: Tone }> = {
  borrador: { label: "Borrador", tone: "gray" },
  planificada: { label: "Planificada", tone: "blue" },
  activa: { label: "Activa", tone: "green" },
  pausada: { label: "Pausada", tone: "amber" },
  finalizada: { label: "Finalizada", tone: "purple" },
  cancelada: { label: "Cancelada", tone: "gray" }
};

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

export const serviceStatusMeta: Record<ServiceLogisticsStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "gray" },
  en_preparacion: { label: "En preparacion", tone: "amber" },
  material_listo: { label: "Material listo", tone: "blue" },
  enviado: { label: "Enviado", tone: "purple" },
  instalado: { label: "Instalado", tone: "green" },
  incidencia: { label: "Incidencia", tone: "red" }
};

// ---------------------------------------------------------------------------
// Materiales
// ---------------------------------------------------------------------------

export const materialStatusMeta: Record<MaterialStatus, { label: string; tone: Tone }> = {
  pendiente_produccion: { label: "Pendiente produccion", tone: "amber" },
  pendiente_recepcion: { label: "Pendiente recepcion", tone: "amber" },
  recibido: { label: "Recibido", tone: "blue" },
  preparado: { label: "Preparado", tone: "purple" },
  enviado: { label: "Enviado", tone: "purple" },
  agotado: { label: "Agotado", tone: "red" },
  activo: { label: "Activo", tone: "green" }
};

// ---------------------------------------------------------------------------
// Movimientos de stock
// ---------------------------------------------------------------------------

export const movementTypeMeta: Record<StockMovementType, { label: string; tone: Tone; sign: 1 | -1 | 0 }> = {
  entrada: { label: "Entrada", tone: "green", sign: 1 },
  salida: { label: "Salida", tone: "red", sign: -1 },
  ajuste: { label: "Ajuste", tone: "amber", sign: 0 },
  reserva: { label: "Reserva", tone: "blue", sign: 0 },
  liberacion_reserva: { label: "Liberacion reserva", tone: "blue", sign: 0 },
  devolucion: { label: "Devolucion", tone: "green", sign: 1 },
  incidencia: { label: "Incidencia", tone: "red", sign: 0 },
  preparacion: { label: "Preparacion", tone: "purple", sign: 0 },
  salida_picking: { label: "Salida picking", tone: "red", sign: -1 },
  envio: { label: "Envio", tone: "purple", sign: -1 }
};

/** Comprueba si una transicion de estado esta permitida (segun el mapa dado). */
export function canTransition<T extends string>(
  meta: Record<T, { next: T[] }>,
  from: T,
  to: T
): boolean {
  if (from === to) return true;
  return meta[from]?.next.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Picking agrupado (PickingBatch)
// ---------------------------------------------------------------------------

export const pickingBatchStatusMeta: Record<PickingBatchStatus, StatusMeta<PickingBatchStatus>> = {
  borrador: { label: "Borrador", tone: "gray", next: ["pendiente_preparacion", "cancelado"] },
  pendiente_preparacion: { label: "Pendiente preparacion", tone: "blue", next: ["en_preparacion", "bloqueado", "cancelado"] },
  en_preparacion: { label: "En preparacion", tone: "amber", next: ["preparado_parcial", "preparado_completo", "con_incidencia", "bloqueado"] },
  preparado_parcial: { label: "Preparado parcial", tone: "amber", next: ["preparado_completo", "con_incidencia", "cerrado", "listo_para_envio"] },
  preparado_completo: { label: "Preparado completo", tone: "purple", next: ["listo_para_envio", "cerrado", "con_incidencia"] },
  bloqueado: { label: "Bloqueado", tone: "red", next: ["en_preparacion", "cancelado"] },
  con_incidencia: { label: "Con incidencia", tone: "red", next: ["en_preparacion", "preparado_parcial", "cerrado", "cancelado"] },
  listo_para_envio: { label: "Listo para envio", tone: "purple", next: ["enviado", "cerrado"] },
  enviado: { label: "Enviado", tone: "green", next: ["cerrado"] },
  cerrado: { label: "Cerrado", tone: "green", next: [] },
  cancelado: { label: "Cancelado", tone: "gray", next: [] }
};

/** Estados de picking que el almacen debe ver en la cola de preparacion. */
export const activePickingStatuses: PickingBatchStatus[] = [
  "borrador",
  "pendiente_preparacion",
  "en_preparacion",
  "preparado_parcial",
  "preparado_completo",
  "bloqueado",
  "con_incidencia",
  "listo_para_envio"
];

/** Estados en los que el picking ya ha descontado stock (cerrado/enviado). */
export const closedPickingStatuses: PickingBatchStatus[] = ["cerrado", "enviado"];

export const pickingLineStatusMeta: Record<PickingLineStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "gray" },
  preparado: { label: "Preparado", tone: "green" },
  parcial: { label: "Parcial", tone: "amber" },
  faltante: { label: "Faltante", tone: "red" },
  incidencia: { label: "Incidencia", tone: "red" },
  cancelada: { label: "Cancelada", tone: "gray" }
};

export const groupingTypeMeta: Record<GroupingType, string> = {
  por_instalador: "Por instalador",
  por_punto_venta: "Por punto de venta",
  por_oficina: "Por oficina",
  por_provincia: "Por provincia",
  por_ruta: "Por ruta",
  por_tipo_material: "Por tipo de material",
  por_campana: "Por campana",
  manual: "Manual"
};

// ---------------------------------------------------------------------------
// Material items (piezas unitarias)
// ---------------------------------------------------------------------------

export const materialItemStatusMeta: Record<MaterialItemStatus, { label: string; tone: Tone }> = {
  pendiente_produccion: { label: "Pendiente produccion", tone: "amber" },
  pendiente_recepcion: { label: "Pendiente recepcion", tone: "amber" },
  recibido: { label: "Recibido", tone: "green" },
  reservado: { label: "Reservado", tone: "blue" },
  preparado: { label: "Preparado", tone: "purple" },
  enviado: { label: "Enviado", tone: "purple" },
  instalado: { label: "Instalado", tone: "green" },
  incidencia: { label: "Incidencia", tone: "red" },
  duplicado: { label: "Duplicado", tone: "red" }
};

/** Estados en los que una pieza cuenta como stock disponible en almacen. */
export const availableItemStatuses: MaterialItemStatus[] = ["recibido"];

// ---------------------------------------------------------------------------
// Importaciones
// ---------------------------------------------------------------------------

export const importTypeMeta: Record<ImportType, string> = {
  isdin_vinilos: "ISDIN / Vinilos a medida",
  banc_sabadell: "Banc Sabadell / Visuales por oficina",
  generico: "Material generico de campana"
};

export const importBatchStatusMeta: Record<ImportBatchStatus, { label: string; tone: Tone }> = {
  borrador: { label: "Borrador", tone: "gray" },
  validado: { label: "Validado", tone: "blue" },
  confirmado: { label: "Confirmado", tone: "green" },
  con_errores: { label: "Con errores", tone: "red" },
  cancelado: { label: "Cancelado", tone: "gray" }
};
