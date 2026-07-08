/**
 * Adaptador de datos LOCAL (fase actual).
 *
 * Mantiene el almacen en memoria y lo persiste en localStorage del navegador
 * para que los cambios sobrevivan a recargas durante las pruebas. En servidor
 * (sin window) opera solo en memoria a partir de los datos semilla.
 *
 * Este es el UNICO fichero que conoce "como" se guardan los datos. Sustituirlo
 * por un adaptador Supabase no deberia requerir cambios en services/*.service.ts.
 */

import { CollectionName, CollectionTypeMap, DataStore } from "@/types";
import { seedDataStore } from "@/data";
import { DataAdapter } from "@/services/adapter";

const STORAGE_KEY = "merchanlogs_store_v2";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class LocalAdapter implements DataAdapter {
  private store: DataStore | null = null;

  private isBrowser(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  private load(): DataStore {
    if (this.store) return this.store;

    if (this.isBrowser()) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          this.store = JSON.parse(raw) as DataStore;
          return this.store;
        } catch {
          // datos corruptos: se re-siembra
        }
      }
    }

    this.store = seedDataStore();
    this.persist();
    return this.store;
  }

  private persist(): void {
    if (this.isBrowser() && this.store) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    }
  }

  async list<K extends CollectionName>(collection: K): Promise<CollectionTypeMap[K][]> {
    const store = this.load();
    return clone(store[collection]);
  }

  async get<K extends CollectionName>(collection: K, id: string): Promise<CollectionTypeMap[K] | null> {
    const store = this.load();
    const found = (store[collection] as CollectionTypeMap[K][]).find((row) => row.id === id);
    return found ? clone(found) : null;
  }

  async insert<K extends CollectionName>(collection: K, entity: CollectionTypeMap[K]): Promise<CollectionTypeMap[K]> {
    const store = this.load();
    (store[collection] as CollectionTypeMap[K][]).push(clone(entity));
    this.persist();
    return clone(entity);
  }

  async update<K extends CollectionName>(
    collection: K,
    id: string,
    patch: Partial<CollectionTypeMap[K]>
  ): Promise<CollectionTypeMap[K]> {
    const store = this.load();
    const list = store[collection] as CollectionTypeMap[K][];
    const index = list.findIndex((row) => row.id === id);
    if (index === -1) throw new Error(`No existe ${collection} con id ${id}`);
    const updated = { ...list[index], ...clone(patch), id } as CollectionTypeMap[K];
    list[index] = updated;
    this.persist();
    return clone(updated);
  }

  async remove<K extends CollectionName>(collection: K, id: string): Promise<void> {
    const store = this.load();
    const list = store[collection] as CollectionTypeMap[K][];
    const index = list.findIndex((row) => row.id === id);
    if (index === -1) return;
    list.splice(index, 1);
    this.persist();
  }

  async reset(): Promise<void> {
    this.store = seedDataStore();
    this.persist();
  }
}

export const localAdapter = new LocalAdapter();
