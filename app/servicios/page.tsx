"use client";

import { useState } from "react";
import { Service, ServiceLogisticsStatus, PointOfSaleType } from "@/types";
import { servicesService } from "@/services/catalog.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, EmptyState, ErrorText, Field, Input, Modal, NoAccess, PageHeader, Select, Table, Td, Textarea
} from "@/components/ui";
import { serviceStatusMeta } from "@/lib/status";
import { formatDate, isoToDateInput, dateInputToIso } from "@/lib/dates";
import { required, validate } from "@/lib/validation";

const statuses: ServiceLogisticsStatus[] = ["pendiente", "en_preparacion", "material_listo", "enviado", "instalado", "incidencia"];
const posTypes: PointOfSaleType[] = ["farmacia", "supermercado", "oficina_bancaria", "tienda", "generico"];
const empty: Partial<Service> = { serviceName: "", serviceCode: "", clientId: "", logisticsStatus: "pendiente", materialsRequired: [] };

export default function ServiciosPage() {
  const { can, user, refreshData } = useSession();
  const { data: services } = useData(() => servicesService.list(), []);
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Service>>(empty);
  const [errors, setErrors] = useState<string[]>([]);

  if (!can("services.view")) return <NoAccess />;
  const canManage = can("services.manage");

  function create() { setForm(empty); setErrors([]); setOpen(true); }
  function edit(s: Service) { setForm(s); setErrors([]); setOpen(true); }

  const campaignsForClient = catalog.campaigns.filter((c) => !form.clientId || c.clientId === form.clientId);
  const materialsForClient = catalog.materials.filter((m) => !form.clientId || m.clientId === form.clientId);

  function toggleMaterial(id: string) {
    const set = new Set(form.materialsRequired ?? []);
    if (set.has(id)) set.delete(id); else set.add(id);
    setForm({ ...form, materialsRequired: Array.from(set) });
  }

  async function save() {
    const result = validate(required(form.serviceName, "Nombre"), required(form.serviceCode, "Codigo"), required(form.clientId, "Cliente"));
    if (!result.valid) return setErrors(result.errors);
    const payload = {
      clientId: form.clientId!,
      campaignId: form.campaignId ?? null,
      serviceName: form.serviceName!.trim(),
      serviceCode: form.serviceCode!.trim(),
      pointOfSaleName: form.pointOfSaleName ?? null,
      pointOfSaleType: (form.pointOfSaleType as PointOfSaleType) ?? null,
      address: form.address ?? null,
      city: form.city ?? null,
      province: form.province ?? null,
      postalCode: form.postalCode ?? null,
      scheduledDate: form.scheduledDate ?? null,
      installationWeek: form.installationWeek ?? null,
      logisticsStatus: (form.logisticsStatus as ServiceLogisticsStatus) ?? "pendiente",
      materialsRequired: form.materialsRequired ?? [],
      notes: form.notes ?? null
    };
    if (form.id) await servicesService.update(form.id, payload, user?.id);
    else await servicesService.create(payload, user?.id);
    setOpen(false);
    refreshData();
  }

  async function remove(s: Service) {
    if (!window.confirm(`Eliminar servicio ${s.serviceName}?`)) return;
    await servicesService.remove(s.id);
    refreshData();
  }

  return (
    <div>
      <PageHeader
        title="Servicios"
        subtitle="Servicios logisticos (punto de venta, provincia, materiales asociados)."
        actions={canManage ? <Button onClick={create}>+ Nuevo servicio</Button> : undefined}
      />

      {!services?.length ? (
        <EmptyState message="No hay servicios." />
      ) : (
        <Table headers={["Servicio", "Cliente / Campana", "Punto de venta", "Provincia", "Fecha", "Estado", ""]}>
          {services.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">
                {s.serviceName}
                <div className="font-mono text-xs text-gray-400">{s.serviceCode}</div>
              </Td>
              <Td>
                {catalog.clientName(s.clientId)}
                <div className="text-xs text-gray-400">{catalog.campaignName(s.campaignId)}</div>
              </Td>
              <Td>{s.pointOfSaleName || "-"}</Td>
              <Td>{s.province || "-"}</Td>
              <Td className="whitespace-nowrap">{formatDate(s.scheduledDate)}</Td>
              <Td>
                <Badge tone={serviceStatusMeta[s.logisticsStatus].tone}>{serviceStatusMeta[s.logisticsStatus].label}</Badge>
              </Td>
              <Td>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => edit(s)}>Editar</Button>
                    <Button variant="danger" onClick={() => remove(s)}>Eliminar</Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={form.id ? "Editar servicio" : "Nuevo servicio"} open={open} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><ErrorText errors={errors} /></div>
          <Field label="Nombre del servicio">
            <Input value={form.serviceName ?? ""} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} />
          </Field>
          <Field label="Codigo">
            <Input value={form.serviceCode ?? ""} onChange={(e) => setForm({ ...form, serviceCode: e.target.value })} />
          </Field>
          <Field label="Cliente / CECO">
            <Select value={form.clientId ?? ""} onChange={(e) => setForm({ ...form, clientId: e.target.value, campaignId: null, materialsRequired: [] })}>
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
          <Field label="Punto de venta">
            <Input value={form.pointOfSaleName ?? ""} onChange={(e) => setForm({ ...form, pointOfSaleName: e.target.value })} />
          </Field>
          <Field label="Tipo de PDV">
            <Select value={form.pointOfSaleType ?? ""} onChange={(e) => setForm({ ...form, pointOfSaleType: (e.target.value || null) as PointOfSaleType })}>
              <option value="">(sin tipo)</option>
              {posTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Direccion"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Ciudad"><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="Provincia"><Input value={form.province ?? ""} onChange={(e) => setForm({ ...form, province: e.target.value })} /></Field>
          <Field label="Codigo postal"><Input value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></Field>
          <Field label="Fecha programada">
            <Input type="date" value={isoToDateInput(form.scheduledDate)} onChange={(e) => setForm({ ...form, scheduledDate: dateInputToIso(e.target.value) })} />
          </Field>
          <Field label="Semana instalacion (ISDIN)" hint="Ej. 2026-W29">
            <Input value={form.installationWeek ?? ""} onChange={(e) => setForm({ ...form, installationWeek: e.target.value })} />
          </Field>
          <Field label="Estado logistico">
            <Select value={form.logisticsStatus ?? "pendiente"} onChange={(e) => setForm({ ...form, logisticsStatus: e.target.value as ServiceLogisticsStatus })}>
              {statuses.map((s) => <option key={s} value={s}>{serviceStatusMeta[s].label}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Materiales requeridos">
              <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 p-2">
                {materialsForClient.length === 0 ? <span className="text-xs text-gray-400">Sin materiales para este cliente</span> : null}
                {materialsForClient.map((m) => {
                  const active = (form.materialsRequired ?? []).includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggleMaterial(m.id)}
                      className={`rounded-full border px-2 py-1 text-xs ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-600"}`}>
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Notas"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
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
