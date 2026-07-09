"use client";

import { listMovements } from "@/services/stock.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { Badge, EmptyState, NoAccess, PageHeader, Table, Td } from "@/components/ui";
import { movementTypeMeta } from "@/lib/status";
import { formatDateTime } from "@/lib/dates";

export default function MovimientosPage() {
  const { can } = useSession();
  const { data: movements } = useData(() => listMovements(), []);
  const { catalog } = useCatalog();

  if (!can("movements.view")) return <NoAccess />;

  const sorted = [...(movements ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <PageHeader
        title="Movimientos de stock"
        subtitle="Registro automatico de cada cambio de stock (entradas, ajustes, preparacion, envios)."
      />
      {!sorted.length ? (
        <EmptyState message="No hay movimientos." />
      ) : (
        <Table headers={["Fecha", "Material", "Tipo", "Cantidad", "Origen → Destino", "Motivo", "Relacionado con"]}>
          {sorted.map((m) => (
            <tr key={m.id}>
              <Td className="whitespace-nowrap text-gray-500">{formatDateTime(m.createdAt)}</Td>
              <Td>{catalog.materialName(m.materialId)}</Td>
              <Td><Badge tone={movementTypeMeta[m.type].tone}>{movementTypeMeta[m.type].label}</Badge></Td>
              <Td>{m.quantity}</Td>
              <Td className="text-xs text-gray-500">{(m.fromLocation || "-") + " → " + (m.toLocation || "-")}</Td>
              <Td className="max-w-xs text-xs text-gray-500">{m.reason || "-"}</Td>
              <Td className="text-xs text-gray-400">{m.relatedEntityType ? `${m.relatedEntityType}: ${m.relatedEntityId}` : "-"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
