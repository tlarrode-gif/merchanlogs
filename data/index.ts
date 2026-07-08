/**
 * Agregador de datos semilla. `seedDataStore()` devuelve una copia fresca del
 * almacen completo, usada por el adaptador local al inicializar.
 */

import { DataStore } from "@/types";
import { users } from "@/data/users";
import { clients } from "@/data/clients";
import { campaigns } from "@/data/campaigns";
import { services } from "@/data/services";
import { materials } from "@/data/materials";
import {
  incidents,
  logisticsRequests,
  requestHistory,
  shipments,
  stockEntries,
  stockMovements
} from "@/data/operations";

export function seedDataStore(): DataStore {
  // Copia profunda para que el almacen mutable no altere los arrays semilla.
  return JSON.parse(
    JSON.stringify({
      users,
      clients,
      campaigns,
      services,
      materials,
      stockEntries,
      stockMovements,
      logisticsRequests,
      requestHistory,
      shipments,
      incidents
    } satisfies DataStore)
  ) as DataStore;
}
