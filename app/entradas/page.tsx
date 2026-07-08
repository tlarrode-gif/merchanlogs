"use client";

import { useState } from "react";
import { StockEntry, StockEntryStatus } from "@/types";
import { listEntries, createEntry, changeEntryStatus, removeEntry, validateEntry } from "@/services/entries.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, EmptyState, ErrorText, Field, Input, Modal, NoAccess, PageHeader, Select, Table, Td, Textarea
} from "@/components/ui";
import { stockEntryStatusMeta } from "@/lib/status";
import { formatDate, isoToDateInput, dateInputToIso, nowIso } from "@/lib/dates";

const statuses: StockEntryStatus[] = ["pendiente_revision", "recibida", "parcialmente_recibida", "rechazada", "incidencia"];

export default function EntradasPage() {
  const { can, user, refreshData } = useSession();
  const { data: entries } = useData(() => listEntries(), []);
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<StockEntry>>({});
  const [errors, setErrors] = useState<string[]>([]);

  if (!can("entries.view")) return <NoAccess />;
  const canManage = can("entries.manage");

  function create() {
    setForm({ status: "pendiente_revision", entryDate: nowIso(), quantity: 1 });
    setErrors([]);
    setOpen(true);
  }

  async function save() {
    const result = validateEntry(form);
    if (!result.valid) return setErrors(result.errors);
    await createEntry(
      {
        clientId: form.clientId!,
        campaignId: form.campaignId ?? null,
        materialId: form.materialId!,
        quantity: Number(form.quantity),
        entryDate: form.entryDate!,
        supplier: form.supplier ?? null,
        deliveryNote: form.deliveryNote ?? null,
        receivedBy: user?.id ?? null,
        status: (form.status as StockEntryStatus) ?? "pendiente_revision",
        notes: form.notes ?? null
      },
      user?.id
    );
    setOpen(false);
    refreshData();
  }

  async function setStatus(entry: StockEntry, status: StockEntryStatus) {
    try {
      await changeEntryStatus(entry.id, status, user?.id);
      refreshData();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    }
  }

  async function remove(entry: StockEntry) {
    if (!window.confirm("Eliminar entrada? (no revierte stock ya aplicado)")) return;
    await removeEntry(entry.id);
    refreshData();
  }

  const materialsForClient = catalog.materials.filter((m) => !form.clientId || m.clientId === form.clientId);
  const campaignsForClient = catalog.campaigns.filter((c) => !form.clientId || c.clientId === form.clientId);

  return (
    <div>
      <PageHeader
        title="Entradas de material"
        subtitle="Recepcion de material. Al marcar 'recibida' se actualiza el stock y se genera un movimiento."
        actions={canManage ? <Button onClick={create}>+ Nueva entrada</Button> : undefined}
      />

      {!entries?.length ? (
        <EmptyState message="No hay entradas registradas." />
      ) : (
        <Table headers={["Fecha", "Cliente / Campana", "Material", "Cantidad", "Proveedor", "Albaran", "Estado", ""]}>
          {entries.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap">{formatDate(e.entryDate)}</Td>
              <Td>
                {catalog.clientName(e.clientId)}
                <div className="text-xs text-gray-400">{catalog.campaignName(e.campaignId)}</div>
              </Td>
              <Td>{catalog.materialName(e.materialId)}</Td>
              <Td>{e.quantity}</Td>
              <Td className="text-gray-500">{e.supplier || "-"}</Td>
              <Td className="font-mono text-xs">{e.deliveryNote || "-"}</Td>
              <Td><Badge tone={stockEntryStatusMeta[e.status].tone}>{stockEntryStatusMeta[e.status].label}</Badge></Td>
              <Td>
                {canManage ? (
                  <div className="flex flex-wrap gap-1">
                    {stockEntryStatusMeta[e.status].next.map((s) => (
                      <Button key={s} variant="secondary" onClick={() => setStatus(e, s)}>→ {stockEntryStatusMeta[s].label}</Button>
                    ))}
                    <Button variant="danger" onClick={() => remove(e)}>Eliminar</Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title="Nueva entrada de material" open={open} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><ErrorText errors={errors} /></div>
          <Field label="Cliente / CECO (obligatorio)">
            <Select value={form.clientId ?? ""} onChange={(e) => setForm({ ...form, clientId: e.target.value, campaignId: null, materialId: undefined })}>
              <option value="">Selecciona cliente</option>
              {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Campana">
            <Select value={form.campaignId ?? ""} onChange={(e) => setForm({ ...form, campaignId: e.target.value || null })}>
              <option value="">(sin campana)</option>
              {campaignsForClient.map((c) => <option key={c.id} value={c.id}>{c.campaignName}</option>)}
            </Select>
          </Field>
          <Field label="Material (obligatorio)">
            <Select value={form.materialId ?? ""} onChange={(e) => setForm({ ...form, materialId: e.target.value })}>
              <option value="">Selecciona material</option>
              {materialsForClient.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Cantidad">
            <Input type="number" min={1} value={form.quantity ?? 1} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </Field>
          <Field label="Fecha de entrada">
            <Input type="date" value={isoToDateInput(form.entryDate)} onChange={(e) => setForm({ ...form, entryDate: dateInputToIso(e.target.value) })} />
          </Field>
          <Field label="Origen / Proveedor">
            <Input value={form.supplier ?? ""} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </Field>
          <Field label="Albaran">
            <Input value={form.deliveryNote ?? ""} onChange={(e) => setForm({ ...form, deliveryNote: e.target.value })} />
          </Field>
          <Field label="Estado inicial" hint="Si eliges 'recibida' se suma stock al crear.">
            <Select value={form.status ?? "pendiente_revision"} onChange={(e) => setForm({ ...form, status: e.target.value as StockEntryStatus })}>
              {statuses.map((s) => <option key={s} value={s}>{stockEntryStatusMeta[s].label}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Observaciones"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
