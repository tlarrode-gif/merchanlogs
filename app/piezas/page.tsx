"use client";

import { useMemo, useState } from "react";
import { listMaterialItems } from "@/services/material-items.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { Badge, EmptyState, NoAccess, PageHeader, Select, Table, Td } from "@/components/ui";
import { materialItemStatusMeta } from "@/lib/status";
import { MaterialsTabs } from "@/components/materials-tabs";

export default function PiezasPage() {
  const { can } = useSession();
  const { data: items } = useData(() => listMaterialItems(), []);
  const { catalog } = useCatalog();
  const [clientId, setClientId] = useState("");
  const [installer, setInstaller] = useState("");
  const [status, setStatus] = useState("");

  const installers = useMemo(
    () => Array.from(new Set((items ?? []).map((i) => i.installer).filter(Boolean))) as string[],
    [items]
  );

  if (!can("materials.view")) return <NoAccess />;
  const filtered = (items ?? []).filter(
    (i) => (!clientId || i.clientId === clientId) && (!installer || i.installer === installer) && (!status || i.status === status)
  );

  return (
    <div>
      <MaterialsTabs />
      <PageHeader
        title="Piezas unitarias"
        subtitle="Inventario de piezas individuales (ej. vinilos VIN de ISDIN). Cada codigo es unico."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={installer} onChange={(e) => setInstaller(e.target.value)}>
          <option value="">Todos los instaladores</option>
          {installers.map((i) => <option key={i} value={i}>{i}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.keys(materialItemStatusMeta).map((s) => <option key={s} value={s}>{materialItemStatusMeta[s as keyof typeof materialItemStatusMeta].label}</option>)}
        </Select>
        <span className="self-center text-sm text-gray-500">{filtered.length} piezas</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No hay piezas con esos filtros. Usa Carga masiva para importar." />
      ) : (
        <Table headers={["Codigo", "Cliente / Campana", "Destino", "Provincia", "Medidas", "Semana", "Instalador", "Estado"]}>
          {filtered.map((i) => (
            <tr key={i.id}>
              <Td className="whitespace-nowrap font-mono text-xs">{i.itemCode}</Td>
              <Td>
                {catalog.clientName(i.clientId)}
                <div className="text-xs text-gray-400">{catalog.campaignName(i.campaignId)}</div>
              </Td>
              <Td className="text-xs">{i.pointOfSaleName || "-"}</Td>
              <Td className="text-xs">{i.province || "-"}</Td>
              <Td className="text-xs text-gray-500">{i.widthCm && i.heightCm ? `${i.widthCm}x${i.heightCm} cm` : "-"}</Td>
              <Td className="text-xs">{i.week || "-"}</Td>
              <Td className="text-xs">{i.installer || "-"}</Td>
              <Td><Badge tone={materialItemStatusMeta[i.status].tone}>{materialItemStatusMeta[i.status].label}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
