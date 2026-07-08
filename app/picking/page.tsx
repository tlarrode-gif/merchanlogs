"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GroupingType, PickingBatch } from "@/types";
import {
  listPickingBatches, createPickingFromItems, createPickingFromRequest, removePickingBatch, summarizeBatch
} from "@/services/picking.service";
import { listRequests } from "@/services/requests.service";
import { listMaterialItems } from "@/services/material-items.service";
import { listIncidents } from "@/services/incidents.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, EmptyState, ErrorText, Field, Modal, NoAccess, PageHeader, Select, Table, Td
} from "@/components/ui";
import { groupingTypeMeta, pickingBatchStatusMeta, priorityMeta } from "@/lib/status";
import { formatDate } from "@/lib/dates";

const groupingOptions: GroupingType[] = [
  "por_instalador", "por_punto_venta", "por_oficina", "por_provincia", "por_ruta", "por_tipo_material", "por_campana", "manual"
];

export default function PickingListPage() {
  const { can, user, refreshData } = useSession();
  const { data: batches } = useData(() => listPickingBatches(), []);
  const { data: requests } = useData(() => listRequests(), []);
  const { data: items } = useData(() => listMaterialItems(), []);
  const { data: incidents } = useData(() => listIncidents(), []);
  const { catalog } = useCatalog();

  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [source, setSource] = useState<"items" | "request">("items");
  const [form, setForm] = useState<{
    clientId: string; campaignId: string; groupingType: GroupingType;
    installer: string; province: string; route: string; pointOfSaleName: string; materialType: string;
    requestId: string;
  }>({ clientId: "", campaignId: "", groupingType: "por_instalador", installer: "", province: "", route: "", pointOfSaleName: "", materialType: "", requestId: "" });

  const clientItems = useMemo(
    () => (items ?? []).filter((it) => (!form.clientId || it.clientId === form.clientId) && (!form.campaignId || it.campaignId === form.campaignId) && it.status === "recibido" && !it.pickingBatchId),
    [items, form.clientId, form.campaignId]
  );
  const installers = Array.from(new Set(clientItems.map((it) => it.installer).filter(Boolean))) as string[];
  const provinces = Array.from(new Set(clientItems.map((it) => it.province).filter(Boolean))) as string[];
  const routes = Array.from(new Set(clientItems.map((it) => it.route).filter(Boolean))) as string[];
  const pending = (requests ?? []).filter((r) => ["solicitada", "en_revision", "preparando", "pendiente_material"].includes(r.status));

  if (!can("picking.view")) return <NoAccess />;
  const canManage = can("picking.manage");

  function openModal() {
    setForm({ clientId: "", campaignId: "", groupingType: "por_instalador", installer: "", province: "", route: "", pointOfSaleName: "", materialType: "", requestId: "" });
    setErrors([]);
    setSource("items");
    setOpen(true);
  }

  async function create() {
    try {
      if (source === "request") {
        const req = (requests ?? []).find((r) => r.id === form.requestId);
        if (!req) return setErrors(["Selecciona una peticion"]);
        await createPickingFromRequest(req, form.groupingType, user?.id);
      } else {
        if (!form.clientId) return setErrors(["Selecciona cliente"]);
        await createPickingFromItems(
          {
            clientId: form.clientId,
            campaignId: form.campaignId || null,
            groupingType: form.groupingType,
            assignedInstaller: form.installer || null,
            province: form.province || null,
            route: form.route || null
          },
          {
            installer: form.installer || null,
            province: form.province || null,
            route: form.route || null,
            pointOfSaleName: form.pointOfSaleName || null,
            materialType: form.materialType || null
          },
          user?.id
        );
      }
      setOpen(false);
      refreshData();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Error"]);
    }
  }

  async function remove(b: PickingBatch) {
    if (b.closedAt) return window.alert("No se puede eliminar un picking ya cerrado.");
    if (!window.confirm(`Eliminar picking ${b.pickingCode}? Se liberaran sus reservas de forma manual.`)) return;
    await removePickingBatch(b.id);
    refreshData();
  }

  return (
    <div>
      <PageHeader
        title="Picking agrupado"
        subtitle="Lotes de preparacion (PickingBatch). El stock se descuenta SOLO al cerrar el picking."
        actions={canManage ? <Button onClick={openModal}>+ Nuevo picking</Button> : undefined}
      />

      {!batches?.length ? (
        <EmptyState message="No hay pickings. Crea uno desde piezas importadas o desde una peticion." />
      ) : (
        <Table headers={["Codigo", "Cliente / Campana", "Agrupacion", "Instalador", "Resumen", "Prioridad", "Estado", ""]}>
          {batches.map((b) => {
            const s = summarizeBatch(b, incidents ?? []);
            return (
              <tr key={b.id}>
                <Td className="whitespace-nowrap font-mono text-xs">
                  <Link href={`/picking/${b.id}`} className="text-blue-600 hover:underline">{b.pickingCode}</Link>
                </Td>
                <Td>
                  {catalog.clientName(b.clientId)}
                  <div className="text-xs text-gray-400">{catalog.campaignName(b.campaignId)}</div>
                </Td>
                <Td className="text-xs">{groupingTypeMeta[b.groupingType]}</Td>
                <Td className="text-xs">{b.assignedInstaller || "-"}</Td>
                <Td className="text-xs text-gray-500">
                  {s.totalPoints} destinos · {s.totalLines} lineas · {s.totalPrepared}/{s.totalUnits} prep.
                  {s.openIncidents > 0 ? <span className="text-red-600"> · {s.openIncidents} inc.</span> : null}
                </Td>
                <Td><Badge tone={priorityMeta[b.priority].tone}>{priorityMeta[b.priority].label}</Badge></Td>
                <Td><Badge tone={pickingBatchStatusMeta[b.status].tone}>{pickingBatchStatusMeta[b.status].label}</Badge></Td>
                <Td>
                  <div className="flex gap-2">
                    <Link href={`/picking/${b.id}`}><Button variant="secondary">Abrir</Button></Link>
                    {canManage && !b.closedAt ? <Button variant="danger" onClick={() => remove(b)}>Eliminar</Button> : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}

      <Modal title="Nuevo picking agrupado" open={open} onClose={() => setOpen(false)} wide>
        <div className="flex flex-col gap-3">
          <ErrorText errors={errors} />
          <Field label="Origen del picking">
            <Select value={source} onChange={(e) => setSource(e.target.value as "items" | "request")}>
              <option value="items">Desde piezas / material importado (filtrado)</option>
              <option value="request">Desde una peticion logistica</option>
            </Select>
          </Field>

          <Field label="Criterio de agrupacion">
            <Select value={form.groupingType} onChange={(e) => setForm({ ...form, groupingType: e.target.value as GroupingType })}>
              {groupingOptions.map((g) => <option key={g} value={g}>{groupingTypeMeta[g]}</option>)}
            </Select>
          </Field>

          {source === "request" ? (
            <Field label="Peticion logistica">
              <Select value={form.requestId} onChange={(e) => setForm({ ...form, requestId: e.target.value })}>
                <option value="">Selecciona peticion</option>
                {pending.map((r) => <option key={r.id} value={r.id}>{r.requestCode} — {catalog.clientName(r.clientId)}</option>)}
              </Select>
            </Field>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Cliente / CECO">
                <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value, campaignId: "", installer: "", province: "", route: "" })}>
                  <option value="">Selecciona cliente</option>
                  {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Campana">
                <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                  <option value="">(todas)</option>
                  {catalog.campaigns.filter((c) => !form.clientId || c.clientId === form.clientId).map((c) => <option key={c.id} value={c.id}>{c.campaignName}</option>)}
                </Select>
              </Field>
              <Field label="Instalador (Banc Sabadell)" hint={`${installers.length} instaladores con piezas disponibles`}>
                <Select value={form.installer} onChange={(e) => setForm({ ...form, installer: e.target.value })}>
                  <option value="">(cualquiera)</option>
                  {installers.map((i) => <option key={i} value={i}>{i}</option>)}
                </Select>
              </Field>
              <Field label="Provincia">
                <Select value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}>
                  <option value="">(cualquiera)</option>
                  {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Ruta">
                <Select value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })}>
                  <option value="">(cualquiera)</option>
                  {routes.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
              <Field label="Piezas que cumplen el filtro">
                <div className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600">{clientItems.filter((it) => (!form.installer || it.installer === form.installer) && (!form.province || it.province === form.province) && (!form.route || it.route === form.route)).length} piezas</div>
              </Field>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create}>Crear picking</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
