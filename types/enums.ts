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
  | "liberacion_reserva"
  | "devolucion"
  | "incidencia"
  | "preparacion"
  | "salida_picking"
  | "envio";

/** Tipo de entidad relacionada con un movimiento (para trazabilidad). */
export type RelatedEntityType =
  | "entrada"
  | "peticion"
  | "picking"
  | "picking_batch"
  | "picking_line"
  | "material_item"
  | "import_batch"
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
  | "material_duplicado"
  | "material_no_localizado"
  | "oficina_incorrecta"
  | "error_agrupacion"
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

// ---------------------------------------------------------------------------
// Material items (piezas unitarias, ej. vinilos VIN de ISDIN)
// ---------------------------------------------------------------------------

/**
 * Estado logistico de una pieza unitaria. Para items unitarios el "stock" no es
 * una cantidad sino el estado de la pieza: esta disponible en almacen mientras
 * su estado sea `recibido`.
 */
export type MaterialItemStatus =
  | "pendiente_produccion"
  | "pendiente_recepcion"
  | "recibido"
  | "reservado"
  | "preparado"
  | "enviado"
  | "instalado"
  | "incidencia"
  | "duplicado";

// ---------------------------------------------------------------------------
// Importaciones / carga masiva
// ---------------------------------------------------------------------------

export type ImportType = "isdin_vinilos" | "banc_sabadell" | "generico";

export type ImportBatchStatus = "borrador" | "validado" | "confirmado" | "con_errores" | "cancelado";

// ---------------------------------------------------------------------------
// Picking agrupado (PickingBatch)
// ---------------------------------------------------------------------------

/** Criterio de agrupacion del picking. */
export type GroupingType =
  | "por_instalador"
  | "por_punto_venta"
  | "por_oficina"
  | "por_provincia"
  | "por_ruta"
  | "por_tipo_material"
  | "por_campana"
  | "manual";

export type PickingBatchStatus =
  | "borrador"
  | "pendiente_preparacion"
  | "en_preparacion"
  | "preparado_parcial"
  | "preparado_completo"
  | "bloqueado"
  | "con_incidencia"
  | "listo_para_envio"
  | "enviado"
  | "cerrado"
  | "cancelado";

/** Estado de cada linea dentro de un picking. */
export type PickingLineStatus =
  | "pendiente"
  | "preparado"
  | "parcial"
  | "faltante"
  | "incidencia"
  | "cancelada";
