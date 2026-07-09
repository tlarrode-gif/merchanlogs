"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IncidentSeverity, IncidentType, PickingLine } from "@/types";
import {
  getPickingBatch, prepareLine, flagLine, cancelLine, closePickingBatch, changeBatchStatus, summarizeBatch, groupLines, getStockCoverage
} from "@/services/picking.service";
import { createIncident, nextIncidentCode, listIncidents } from "@/services/incidents.service";
import { createShipmentFromPicking } from "@/services/shipments.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, NoAccess, PageHeader, Select, StatCard, Table, Td, Textarea
} from "@/components/ui";
import {
  groupingTypeMeta, pickingBatchStatusMeta, pickingLineStatusMeta, priorityMeta
} from "@/lib/status";
import { formatDateTime } from "@/lib/dates";

const incidentTypes: IncidentType[] = [
  "material_faltante", "medidas_incorrectas", "material_no_encaja", "material_no_localizado",
  "material_duplicado", "oficina_incorrecta", "error_agrupacion", "rotura", "error_picking", "otra"
];
const severities: IncidentSeverity[] = ["baja", "media", "alta", "critica"];

export default function PickingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const { can, user, refreshData } = useSession();
  const { data: batch } = useData(() => getPickingBatch(id), [id]);
  const { data: incidents } = useData(() => listIncidents(), []);
  const { data: coverage } = useData(async () => (batch ? getStockCoverage(batch) : []), [batch?.id, batch?.updatedAt]);
  const { catalog } = useCatalog();

  const [incidentModal, setIncidentModal] = useState<{ line: PickingLine } | null>(null);
  const [incForm, setIncForm] = useState<{ title: string; type: IncidentType; severity: IncidentSeverity; blocksPicking: boolean; description: string }>({ title: "", type: "material_faltante", severity: "media", blocksPicking: false, description: "" });
  const [shipModal, setShipModal] = useState(false);
  const [shipForm, setShipForm] = useState<{ carrier: string; trackingNumber: string }>({ carrier: "", trackingNumber: "" });

  const groups = useMemo(() => (batch ? groupLines(batch) : []), [batch]);
  const coverageMap = useMemo(() => new Map((coverage ?? []).map((c) => [c.line.id, c])), [coverage]);

  if (!can("picking.view")) return <NoAccess />;
  if (!batch) return <p className="text-sm text-gray-400">Cargando picking...</p>;

  const canManage = can("picking.manage");
  const summary = summarizeBatch(batch, incidents ?? []);
  const closed = !!batch.closedAt;

  async function prepare(line: PickingLine) {
    let qty: number | undefined;
    if (!line.materialItemId && line.quantity > 1) {
      const raw = window.prompt(`Cantidad preparada (de ${line.quantity}):`, String(line.quantity));
      if (raw === null) return;
      qty = Number(raw);
    }
    await prepareLine(batch!.id, line.id, qty, user?.id);
    refreshData();
  }

  async function cancel(line: PickingLine) {
    if (!window.confirm(`Cancelar la linea "${line.description}"? No se preparara ni se enviara.`)) return;
    await cancelLine(batch!.id, line.id, user?.id);
    refreshData();
  }

  function openIncident(line: PickingLine) {
    setIncForm({ title: `Incidencia en ${line.description}`, type: "material_faltante", severity: "media", blocksPicking: false, description: "" });
    setIncidentModal({ line });
  }

  async function saveIncident() {
    if (!incidentModal) return;
    const line = incidentModal.line;
    const code = await nextIncidentCode();
    const incident = await createIncident(
      {
        incidentCode: code,
        title: incForm.title,
        description: incForm.description || null,
        clientId: batch!.clientId,
        campaignId: batch!.campaignId ?? null,
        serviceId: null,
        pointOfSaleName: line.officeName || line.pointOfSaleName || null,
        materialId: line.materialId ?? null,
        materialItemId: line.materialItemId ?? null,
        shipmentId: null,
        logisticsRequestId: batch!.logisticsRequestId ?? null,
        stockEntryId: null,
        pickingBatchId: batch!.id,
        pickingLineId: line.id,
        importBatchId: batch!.importBatchId ?? null,
        type: incForm.type,
        severity: incForm.severity,
        status: "abierta",
        assignedTo: null,
        resolvedAt: null,
        resolutionNotes: null,
        blocksPicking: incForm.blocksPicking
      },
      user?.id
    );
    await flagLine(batch!.id, line.id, "incidencia", incident.id, user?.id);
    setIncidentModal(null);
    refreshData();
  }

  async function setStatus(to: Parameters<typeof changeBatchStatus>[1]) {
    try {
      await changeBatchStatus(batch!.id, to, user?.id);
      refreshData();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    }
  }

  async function close() {
    if (!window.confirm("Cerrar picking? Esto DESCONTARA el stock de lo preparado (no reversible).")) return;
    try {
      const res = await closePickingBatch(batch!.id, user?.id);
      refreshData();
      window.alert(`Picking cerrado. Unidades descontadas: ${res.consumedUnits}${res.partial ? " (cierre parcial)" : ""}.`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    }
  }

  async function createShipment() {
    await createShipmentFromPicking(batch!, { carrier: shipForm.carrier || null, trackingNumber: shipForm.trackingNumber || null }, user?.id);
    setShipModal(false);
    refreshData();
    router.push("/envios");
  }

  return (
    <div>
      <PageHeader
        title={`Picking ${batch.pickingCode}`}
        subtitle={`${catalog.clientName(batch.clientId)} · ${catalog.campaignName(batch.campaignId)} · ${groupingTypeMeta[batch.groupingType]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/picking"><Button variant="secondary">← Volver</Button></Link>
            <Link href={`/picking/${batch.id}/print`}><Button variant="secondary">Imprimir hoja</Button></Link>
            {canManage && !closed ? <Button onClick={close}>Cerrar picking (descuenta stock)</Button> : null}
            {canManage && batch.status === "listo_para_envio" ? <Button onClick={() => setShipModal(true)}>Crear envio</Button> : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={pickingBatchStatusMeta[batch.status].tone}>{pickingBatchStatusMeta[batch.status].label}</Badge>
        <Badge tone={priorityMeta[batch.priority].tone}>{priorityMeta[batch.priority].label}</Badge>
        {batch.assignedInstaller ? <span className="text-gray-500">Instalador: <strong>{batch.assignedInstaller}</strong></span> : null}
        {closed ? <span className="text-green-700">Cerrado: {formatDateTime(batch.closedAt)}</span> : null}
        {canManage && !closed && pickingBatchStatusMeta[batch.status].next.includes("bloqueado") ? (
          <Button variant="ghost" onClick={() => setStatus("bloqueado")}>Bloquear</Button>
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Destinos" value={summary.totalPoints} tone="blue" />
        <StatCard label="Lineas" value={summary.totalLines} tone="gray" />
        <StatCard label="Unidades" value={summary.totalUnits} tone="gray" />
        <StatCard label="Preparado" value={`${summary.totalPrepared}/${summary.totalUnits}`} tone="purple" />
        <StatCard label="Incidencias" value={summary.openIncidents} tone={summary.openIncidents ? "red" : "green"} />
      </div>

      {groups.length === 0 ? (
        <EmptyState message="Este picking no tiene lineas." />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <Card key={group.key}>
              <h3 className="mb-2 text-sm font-semibold text-gray-800">{group.key} <span className="text-xs font-normal text-gray-400">({group.lines.length} lineas)</span></h3>
              <Table headers={["Destino", "Material", "Medidas", "Cant.", "Prep.", "Estado", "Cobertura", ""]}>
                {group.lines.map((line) => {
                  const cov = coverageMap.get(line.id);
                  return (
                    <tr key={line.id}>
                      <Td className="text-xs">
                        {line.officeName || line.pointOfSaleName || "-"}
                        <div className="text-gray-400">{[line.city, line.province].filter(Boolean).join(", ")}</div>
                        {line.serviceCode ? <div className="font-mono text-gray-400">{line.serviceCode}</div> : null}
                      </Td>
                      <Td className="text-xs">{line.description}</Td>
                      <Td className="text-xs text-gray-500">{line.dimensions || "-"}</Td>
                      <Td>{line.quantity}</Td>
                      <Td>{line.preparedQuantity}</Td>
                      <Td><Badge tone={pickingLineStatusMeta[line.status].tone}>{pickingLineStatusMeta[line.status].label}</Badge></Td>
                      <Td className="text-xs">
                        {line.materialId ? (cov?.covered ? <span className="text-green-700">OK ({cov.available})</span> : <span className="text-red-600">Falta ({cov?.available ?? 0})</span>) : <span className="text-gray-400">pieza</span>}
                      </Td>
                      <Td>
                        {canManage && !closed ? (
                          <div className="flex gap-1">
                            {line.status !== "preparado" && line.status !== "cancelada" ? <Button variant="secondary" onClick={() => prepare(line)}>Preparar</Button> : null}
                            {line.status !== "incidencia" && line.status !== "cancelada" ? <Button variant="ghost" onClick={() => openIncident(line)}>Incidencia</Button> : null}
                            {line.status !== "cancelada" ? <Button variant="ghost" onClick={() => cancel(line)}>Cancelar</Button> : null}
                          </div>
                        ) : line.incidentId ? <span className="text-xs text-red-600">inc.</span> : null}
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            </Card>
          ))}
        </div>
      )}

      {/* Modal incidencia de linea */}
      <Modal title="Registrar incidencia" open={!!incidentModal} onClose={() => setIncidentModal(null)}>
        <div className="flex flex-col gap-3">
          <Field label="Titulo"><Input value={incForm.title} onChange={(e) => setIncForm({ ...incForm, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={incForm.type} onChange={(e) => setIncForm({ ...incForm, type: e.target.value as IncidentType })}>
                {incidentTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </Select>
            </Field>
            <Field label="Severidad">
              <Select value={incForm.severity} onChange={(e) => setIncForm({ ...incForm, severity: e.target.value as IncidentSeverity })}>
                {severities.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incForm.blocksPicking} onChange={(e) => setIncForm({ ...incForm, blocksPicking: e.target.checked })} />
            Bloquea el cierre del picking
          </label>
          <Field label="Descripcion"><Textarea rows={2} value={incForm.description} onChange={(e) => setIncForm({ ...incForm, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIncidentModal(null)}>Cancelar</Button>
            <Button onClick={saveIncident}>Registrar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal envio */}
      <Modal title="Crear envio desde picking" open={shipModal} onClose={() => setShipModal(false)}>
        <div className="flex flex-col gap-3">
          <Field label="Transportista"><Input value={shipForm.carrier} onChange={(e) => setShipForm({ ...shipForm, carrier: e.target.value })} /></Field>
          <Field label="Tracking (opcional)"><Input value={shipForm.trackingNumber} onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShipModal(false)}>Cancelar</Button>
            <Button onClick={createShipment}>Crear envio</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
