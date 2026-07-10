"use client";

/**
 * Campañas (rediseño, mockup image3): seguimiento de hitos logisticos por
 * campaña con KPIs y barras de progreso de produccion/envios calculadas de las
 * peticiones, pickings, envios e incidencias reales.
 */

import { useMemo, useState } from "react";
import { Megaphone, Plus, TriangleAlert } from "lucide-react";
import { Campaign, CampaignStatus } from "@/types";
import { campaignsService } from "@/services/catalog.service";
import { getAdapter } from "@/services/adapter";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { CampaignTabs } from "@/components/campaign-tabs";
import { Chip, Empty, Kpi, PageHeader, Panel, Progress } from "@/components/lg";
import { Button, ErrorText, Field, Input, Modal, NoAccess, Select, Textarea } from "@/components/ui";
import { campaignStatusMeta } from "@/lib/status";
import { formatDate, isoToDateInput, dateInputToIso } from "@/lib/dates";
import { required, validate } from "@/lib/validation";

const statuses: CampaignStatus[] = ["borrador", "planificada", "activa", "pausada", "finalizada", "cancelada"];
const empty: Partial<Campaign> = { campaignName: "", clientId: "", status: "borrador" };

export default function CampanasPage() {
  const { can, user, refreshData } = useSession();
  const { data } = useData(async () => {
    const adapter = getAdapter();
    const [campaigns, requests, pickings, shipments, incidents] = await Promise.all([
      campaignsService.list(),
      adapter.list("logisticsRequests"),
      adapter.list("pickingBatches"),
      adapter.list("shipments"),
      adapter.list("incidents")
    ]);
    return { campaigns, requests, pickings, shipments, incidents };
  }, []);
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Campaign>>(empty);
  const [errors, setErrors] = useState<string[]>([]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.campaigns.map((c) => {
      const requests = data.requests.filter((r) => r.campaignId === c.id);
      const totalQty = requests.reduce((s, r) => s + r.materials.reduce((x, l) => x + l.quantity, 0), 0);
      const preparedQty = requests.reduce((s, r) => s + r.materials.reduce((x, l) => x + Math.min(l.preparedQuantity, l.quantity), 0), 0);
      const shipped = requests.filter((r) => ["enviada", "entregada"].includes(r.status)).length;
      const openIncidents = data.incidents.filter((i) => i.campaignId === c.id && !["resuelta", "cancelada"].includes(i.status)).length;
      return {
        campaign: c,
        requests: requests.length,
        produccionPct: totalQty ? Math.round((preparedQty / totalQty) * 100) : 0,
        enviosPct: requests.length ? Math.round((shipped / requests.length) * 100) : 0,
        incidencias: openIncidents
      };
    });
  }, [data]);

  if (!can("campaigns.view")) return <NoAccess />;
  const canManage = can("campaigns.manage");
  const campaigns = data?.campaigns ?? [];

  const kpis = {
    activas: campaigns.filter((c) => c.status === "activa").length,
    produccionMedia: rows.length ? Math.round(rows.reduce((s, r) => s + r.produccionPct, 0) / rows.length) : 0,
    incidencias: rows.reduce((s, r) => s + r.incidencias, 0),
    proximas: campaigns.filter((c) => c.status === "planificada").length
  };

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
    const result = validate(required(form.campaignName, "El nombre es obligatorio"), required(form.clientId, "El cliente es obligatorio"));
    if (!result.valid) return setErrors(result.errors);
    const payload = {
      clientId: form.clientId!,
      ceco: form.ceco ?? null,
      campaignName: form.campaignName!,
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

  return (
    <div className="space-y-4">
      <CampaignTabs />
      <PageHeader
        title="Campañas"
        subtitle="Seguimiento de hitos logísticos y KPIs de producción"
        actions={canManage ? (
          <button className="lg-btn lg-btn-primary" onClick={create}>
            <Plus className="h-4 w-4" /> Nueva Campaña
          </button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Campañas activas" value={kpis.activas} icon={<Megaphone className="h-4 w-4" />} />
        <Kpi label="Producción media" value={`${kpis.produccionMedia}%`} tone="blue" hint={<Progress value={kpis.produccionMedia} />} />
        <Kpi label="Incidencias abiertas" value={kpis.incidencias} tone={kpis.incidencias ? "danger" : "default"} icon={<TriangleAlert className="h-4 w-4" />} />
        <Kpi label="Próximos lanzamientos" value={kpis.proximas} />
      </div>

      <Panel title={`Listado de campañas (${rows.length})`}>
        {!rows.length ? (
          <Empty>No hay campañas registradas.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="lg-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Campaña</th>
                  <th>Lanzamiento</th>
                  <th>Peticiones</th>
                  <th>Producción</th>
                  <th>Envíos</th>
                  <th>Incidencias</th>
                  <th>Estado</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ campaign: c, ...r }) => (
                  <tr key={c.id}>
                    <td className="font-bold">{catalog.clientName(c.clientId)}</td>
                    <td>
                      <p className="font-medium">{c.campaignName}</p>
                      {c.ceco && <p className="text-[10px] text-slate-400">CECO {c.ceco}</p>}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{formatDate(c.startDate)}</td>
                    <td className="text-xs font-semibold">{r.requests} pet.</td>
                    <td className="min-w-[120px]">
                      <p className="mb-1 text-[10px] font-bold text-slate-500">{r.produccionPct}%</p>
                      <Progress value={r.produccionPct} />
                    </td>
                    <td className="min-w-[120px]">
                      <p className="mb-1 text-[10px] font-bold text-slate-500">{r.enviosPct}%</p>
                      <Progress value={r.enviosPct} tone="dark" />
                    </td>
                    <td>
                      {r.incidencias > 0 ? <Chip tone="red">{r.incidencias} incidencias</Chip> : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td><Chip tone={campaignStatusMeta[c.status].tone}>● {campaignStatusMeta[c.status].label}</Chip></td>
                    {canManage && (
                      <td>
                        <button className="lg-btn lg-btn-outline lg-btn-sm" onClick={() => edit(c)}>Editar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal title={form.id ? `Editar ${form.campaignName}` : "Nueva campaña"} open={open} onClose={() => setOpen(false)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><ErrorText errors={errors} /></div>
          <Field label="Nombre"><Input value={form.campaignName ?? ""} onChange={(e) => setForm({ ...form, campaignName: e.target.value })} /></Field>
          <Field label="Cliente">
            <Select value={form.clientId ?? ""} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Selecciona cliente</option>
              {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="CECO"><Input value={form.ceco ?? ""} onChange={(e) => setForm({ ...form, ceco: e.target.value })} /></Field>
          <Field label="Estado">
            <Select value={form.status ?? "borrador"} onChange={(e) => setForm({ ...form, status: e.target.value as CampaignStatus })}>
              {statuses.map((s) => <option key={s} value={s}>{campaignStatusMeta[s].label}</option>)}
            </Select>
          </Field>
          <Field label="Inicio"><Input type="date" value={isoToDateInput(form.startDate)} onChange={(e) => setForm({ ...form, startDate: dateInputToIso(e.target.value) })} /></Field>
          <Field label="Fin"><Input type="date" value={isoToDateInput(form.endDate)} onChange={(e) => setForm({ ...form, endDate: dateInputToIso(e.target.value) })} /></Field>
          <div className="md:col-span-2">
            <Field label="Descripción"><Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
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
