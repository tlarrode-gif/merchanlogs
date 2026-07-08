/** Punto unico de importacion de tipos del dominio. */
export * from "@/types/base";
export * from "@/types/enums";
export * from "@/types/entities";

import {
  Campaign,
  Client,
  Incident,
  LogisticsRequest,
  Material,
  RequestHistoryEntry,
  Service,
  Shipment,
  StockEntry,
  StockMovement,
  User
} from "@/types/entities";

/**
 * Nombres de las colecciones gestionadas por la capa de datos. Cada nombre se
 * mapeara 1:1 a una tabla de Supabase en el futuro.
 */
export type CollectionName =
  | "users"
  | "clients"
  | "campaigns"
  | "services"
  | "materials"
  | "stockEntries"
  | "stockMovements"
  | "logisticsRequests"
  | "requestHistory"
  | "shipments"
  | "incidents";

/** Mapa coleccion -> tipo de entidad, usado por el repositorio generico. */
export interface CollectionTypeMap {
  users: User;
  clients: Client;
  campaigns: Campaign;
  services: Service;
  materials: Material;
  stockEntries: StockEntry;
  stockMovements: StockMovement;
  logisticsRequests: LogisticsRequest;
  requestHistory: RequestHistoryEntry;
  shipments: Shipment;
  incidents: Incident;
}

/** Estructura completa del almacen de datos (una entrada por coleccion). */
export type DataStore = {
  [K in CollectionName]: CollectionTypeMap[K][];
};
