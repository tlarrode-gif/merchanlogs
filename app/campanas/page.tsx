"use client";

import { useState } from "react";
import { Campaign, CampaignStatus } from "@/types";
import { campaignsService } from "@/services/catalog.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, EmptyState, ErrorText, Field, Input, Modal, NoAccess, PageHeader, Select, Table, Td, Textarea
} from "@/components/ui";
import { campaignStatusMeta } from "@/lib/status";
import { formatDate, isoToDateInput, dateInputToIso } from "@/lib/dates";
import { required, validate } from "@/lib/validation";

const statuses: CampaignStatus[] = ["borrador", "planificada", "activa", "pausada", "finalizada", "cancelada"];
const empty: Partial<Campaign> = { campaignName: "", clientId: "", status: "borrador" };

export default function CampanasPage() {
  const { can, user, refreshData } = useSession();
  const { data: campaigns } = useData(() => campaignsService.list(), []);
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Campaign>>(empty);
  const [errors, setErrors] = useState<string[]>([]);

  if (!can("campaigns.view")) return <NoAccess />;
  const canManage = can("campaigns.manage");

  function create() {
    setForm(empty);
    setErrors([]);
    setOpen(true);
  }
  function edit(c: Campaign) {
    setForm(c);
    setErrors([]);
    setOpen(true);
  }

  async function save() {
    const result = validate(required(form.campaignName, "Nombre"), required(form.clientId, "Cliente"));
    if (!result.valid) return setErrors(result.errors);
    const client = catalog.clients.find((c) => c.id === form.clientId);
    const payload = {
      clientId: form.clientId!,
      ceco: client?.ceco ?? form.ceco ?? null,
      campaignName: form.campaignName!.trim(),
      description: form.description ?? null,
      startDate: form.startDate ?? null,
      endDate: form.endDate ?? null,
      status: (form.status as CampaignStatus) ?? "borrador"
    };
    if (form.id) await campaignsService.update(form.id, payload, user?.id);
    else await campaignsService.create(payload, user?.id);
    setOpen(false);
    refreshData();
  }

  async function remove(c: Campaign) {
    if (!window.confirm(`Eliminar campana ${c.campaignName}?`)) return;
    await campaignsService.remove(c.id);
    refreshData();
  }

  return (
    <div>
      <PageHeader
        title="Campanas"
        subtitle="Campanas vinculadas a clientes/CECOs."
        actions={canManage ? <Button onClick={create}>+ Nueva campana</Button> : undefined}
      />

      {!campaigns?.length ? (
        <EmptyState message="No hay campanas." />
      ) : (
        <Table headers={["Campana", "Cliente", "Periodo", "Estado", "Origen", ""]}>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <Td className="font-medium">{c.campaignName}</Td>
              <Td>{catalog.clientName(c.clientId)}</Td>
              <Td className="whitespace-nowrap text-gray-500">
                {formatDate(c.startDate)} → {formatDate(c.endDate)}
              </Td>
              <Td>
                <Badge tone={campaignStatusMeta[c.status].tone}>{campaignStatusMeta[c.status].label}</Badge>
              </Td>
              <Td>
                <Badge tone={c.sourceSystem === "merchanops" ? "purple" : "gray"}>{c.sourceSystem}</Badge>
              </Td>
              <Td>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => edit(c)}>Editar</Button>
                    <Button variant="danger" onClick={() => remove(c)}>Eliminar</Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={form.id ? "Editar campana" : "Nueva campana"} open={open} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <ErrorText errors={errors} />
          </div>
          <Field label="Nombre de campana">
            <Input value={form.campaignName ?? ""} onChange={(e) => setForm({ ...form, campaignName: e.target.value })} />
          </Field>
          <Field label="Cliente / CECO">
            <Select value={form.clientId ?? ""} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Selecciona cliente</option>
              {catalog.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.ceco})</option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha inicio">
            <Input type="date" value={isoToDateInput(form.startDate)} onChange={(e) => setForm({ ...form, startDate: dateInputToIso(e.target.value) })} />
          </Field>
          <Field label="Fecha fin">
            <Input type="date" value={isoToDateInput(form.endDate)} onChange={(e) => setForm({ ...form, endDate: dateInputToIso(e.target.value) })} />
          </Field>
          <Field label="Estado">
            <Select value={form.status ?? "borrador"} onChange={(e) => setForm({ ...form, status: e.target.value as CampaignStatus })}>
              {statuses.map((s) => (
                <option key={s} value={s}>{campaignStatusMeta[s].label}</option>
              ))}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Descripcion">
              <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
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
