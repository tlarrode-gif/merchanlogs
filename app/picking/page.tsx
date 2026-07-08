"use client";

import { useEffect, useState } from "react";
import { LogisticsRequest } from "@/types";
import { listRequests } from "@/services/requests.service";
import { getPickingStatus, prepareLine, refreshRequestPickingState, pickingStatuses, PickingLineStatus } from "@/services/picking.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { Badge, Button, Card, EmptyState, NoAccess, PageHeader, Table, Td } from "@/components/ui";
import { priorityMeta, requestStatusMeta } from "@/lib/status";

export default function PickingPage() {
  const { can, user, refreshData } = useSession();
  const { data: requests } = useData(() => listRequests(), []);
  const { catalog } = useCatalog();

  if (!can("picking.view")) return <NoAccess />;
  const canManage = can("picking.manage");

  const queue = (requests ?? []).filter((r) => (pickingStatuses as readonly string[]).includes(r.status));

  return (
    <div>
      <PageHeader
        title="Picking / Preparacion"
        subtitle="Cola de preparacion de almacen. Preparar material descuenta stock y actualiza el estado de la peticion."
      />
      {queue.length === 0 ? (
        <EmptyState message="No hay peticiones en cola de preparacion." />
      ) : (
        <div className="flex flex-col gap-4">
          {queue.map((r) => (
            <PickingCard key={r.id} request={r} canManage={canManage} actorId={user?.id} onChange={refreshData} clientName={catalog.clientName(r.clientId)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PickingCard({
  request, canManage, actorId, onChange, clientName
}: {
  request: LogisticsRequest;
  canManage: boolean;
  actorId?: string | null;
  onChange: () => void;
  clientName: string;
}) {
  const [status, setStatus] = useState<PickingLineStatus[]>([]);

  useEffect(() => {
    getPickingStatus(request).then(setStatus);
  }, [request]);

  async function prepare(materialId: string, remaining: number) {
    const raw = window.prompt(`Cantidad a preparar (quedan ${remaining}):`, String(remaining));
    if (!raw) return;
    const qty = Number(raw);
    if (!qty || qty <= 0) return;
    try {
      await prepareLine(request.id, materialId, qty, actorId);
      await refreshRequestPickingState(request.id, actorId);
      onChange();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    }
  }

  async function recalc() {
    try {
      await refreshRequestPickingState(request.id, actorId);
      onChange();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono text-sm">{request.requestCode}</span>
          <span className="ml-2 text-sm text-gray-600">{clientName}</span>
          {request.destination ? <span className="ml-2 text-xs text-gray-400">→ {request.destination}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={priorityMeta[request.priority].tone}>{priorityMeta[request.priority].label}</Badge>
          <Badge tone={requestStatusMeta[request.status].tone}>{requestStatusMeta[request.status].label}</Badge>
          {canManage ? <Button variant="secondary" onClick={recalc}>Recalcular estado</Button> : null}
        </div>
      </div>
      {status.length === 0 ? (
        <p className="text-xs text-gray-400">Esta peticion no tiene materiales.</p>
      ) : (
        <Table headers={["Material", "Solicitado", "Preparado", "Disponible", "Situacion", ""]}>
          {status.map((s) => {
            const remaining = s.requested - s.prepared;
            return (
              <tr key={s.materialId} className={s.shortage && !s.complete ? "bg-red-50/40" : ""}>
                <Td>{s.materialName}</Td>
                <Td>{s.requested}</Td>
                <Td>{s.prepared}</Td>
                <Td>{s.available}</Td>
                <Td>
                  {s.complete ? <Badge tone="green">Completo</Badge> : s.shortage ? <Badge tone="red">Falta stock</Badge> : <Badge tone="amber">Pendiente</Badge>}
                </Td>
                <Td>
                  {canManage && !s.complete ? (
                    <Button variant="secondary" disabled={s.available <= 0} onClick={() => prepare(s.materialId, remaining)}>
                      Preparar
                    </Button>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </Card>
  );
}
