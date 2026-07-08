/**
 * Enumeraciones y estados del dominio logistico.
 *
 * Se modelan como uniones de literales (no enums de TS) para que sean
 * serializables directamente a columnas de texto en Supabase mas adelante.
 * Las etiquetas legibles y transiciones permitidas viven en lib/status.ts.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type Role = "administracion" | "gestor" | "almacen";

// ---------------------------------------------------------------------------
// Materiales
// ---------------------------------------------------------------------------

export type MaterialType =
  | "vinilo"
  | "plv"
  | "display"
  | "carteleria"
  | "muestra"
  | "promocional"
  | "generico"
  | "otro";

export type MaterialStatus =
  | "pendiente_produccion"
  | "pendiente_recepcion"
  | "recibido"
  | "preparado"
  | "enviado"
  | "agotado"
  | "activo";

// ---------------------------------------------------------------------------
// Puntos de venta
// ---------------------------------------------------------------------------

export type PointOfSaleType =
  | "farmacia"
  | "supermercado"
  | "oficina_bancaria"
  | "tienda"
  | "generico";

// ---------------------------------------------------------------------------
// Campanas
// ---------------------------------------------------------------------------

export type CampaignStatus =
  | "borrador"
  | "planificada"
  | "activa"
  | "pausada"
  | "finalizada"
  | "cancelada";

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

export type ServiceLogisticsStatus =
  | "pendiente"
  | "en_preparacion"
  | "material_listo"
  | "enviado"
  | "instalado"
  | "incidencia";

// ---------------------------------------------------------------------------
// Entradas de material
// ---------------------------------------------------------------------------

export type StockEntryStatus =
  | "pendiente_revision"
  | "recibida"
  | "parcialmente_recibida"
  | "rechazada"
  | "incidencia";

// ---------------------------------------------------------------------------
// Movimientos de stock
// ---------------------------------------------------------------------------

export type StockMovementType =
  | "entrada"
  | "salida"
  | "ajuste"
  | "reserva"
  | "devolucion"
  | "incidencia"
  | "preparacion"
  | "envio";

/** Tipo de entidad relacionada con un movimiento (para trazabilidad). */
export type RelatedEntityType =
  | "entrada"
  | "peticion"
  | "picking"
  | "envio"
  | "incidencia"
  | "ajuste_manual";

// ---------------------------------------------------------------------------
// Peticiones logisticas
// ---------------------------------------------------------------------------

export type LogisticsRequestStatus =
  | "borrador"
  | "solicitada"
  | "en_revision"
  | "preparando"
  | "pendiente_material"
  | "lista_para_envio"
  | "enviada"
  | "entregada"
  | "incidencia"
  | "cancelada";

export type Priority = "baja" | "normal" | "alta" | "urgente";

// ---------------------------------------------------------------------------
// Envios
// ---------------------------------------------------------------------------

export type ShipmentStatus =
  | "pendiente"
  | "preparado"
  | "enviado"
  | "en_transito"
  | "entregado"
  | "incidencia"
  | "devuelto"
  | "cancelado";

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

export type IncidentType =
  | "material_faltante"
  | "material_incorrecto"
  | "medidas_incorrectas"
  | "material_no_encaja"
  | "rotura"
  | "retraso_envio"
  | "error_picking"
  | "error_stock"
  | "incidencia_proveedor"
  | "incidencia_transporte"
  | "otra";

export type IncidentSeverity = "baja" | "media" | "alta" | "critica";

export type IncidentStatus =
  | "abierta"
  | "en_revision"
  | "en_curso"
  | "bloqueada"
  | "resuelta"
  | "cancelada";
