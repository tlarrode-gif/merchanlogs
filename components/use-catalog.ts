"use client";

/**
 * Carga las colecciones de catalogo (clientes, campanas, servicios, materiales,
 * usuarios) y expone mapas id->nombre para resolver referencias en las tablas.
 */

import { Campaign, Client, Material, Service, User } from "@/types";
import { getAdapter } from "@/services/adapter";
import { useData } from "@/components/use-data";

export interface Catalog {
  clients: Client[];
  campaigns: Campaign[];
  services: Service[];
  materials: Material[];
  users: User[];
  clientName: (id?: string | null) => string;
  campaignName: (id?: string | null) => string;
  serviceName: (id?: string | null) => string;
  materialName: (id?: string | null) => string;
  userName: (id?: string | null) => string;
}

export function useCatalog() {
  const { data, loading } = useData<Omit<Catalog, "clientName" | "campaignName" | "serviceName" | "materialName" | "userName">>(
    async () => {
      const adapter = getAdapter();
      const [clients, campaigns, services, materials, users] = await Promise.all([
        adapter.list("clients"),
        adapter.list("campaigns"),
        adapter.list("services"),
        adapter.list("materials"),
        adapter.list("users")
      ]);
      return { clients, campaigns, services, materials, users };
    },
    []
  );

  const catalog: Catalog = {
    clients: data?.clients ?? [],
    campaigns: data?.campaigns ?? [],
    services: data?.services ?? [],
    materials: data?.materials ?? [],
    users: data?.users ?? [],
    clientName: (id) => data?.clients.find((c) => c.id === id)?.name ?? "-",
    campaignName: (id) => data?.campaigns.find((c) => c.id === id)?.campaignName ?? "-",
    serviceName: (id) => data?.services.find((s) => s.id === id)?.serviceName ?? "-",
    materialName: (id) => data?.materials.find((m) => m.id === id)?.name ?? "-",
    userName: (id) => data?.users.find((u) => u.id === id)?.displayName ?? "-"
  };

  return { catalog, loading };
}
