"use client";

import { useState } from "react";
import { Material, MaterialType, MaterialStatus } from "@/types";
import { materialsService } from "@/services/catalog.service";
import { applyStockDelta, availableStock } from "@/services/stock.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import {
  Badge, Button, EmptyState, ErrorText, Field, Input, Modal, NoAccess, PageHeader, Select, Table, Td, Textarea
} from "@/components/ui";
import { materialStatusMeta } from "@/lib/status";
import { required, validate, nonNegative } from "@/lib/validation";
import { MaterialsTabs } from "@/components/materials-tabs";

const types: MaterialType[] = ["vinilo", "plv", "display", "carteleria", "muestra", "promocional", "generico", "otro"];
const statuses: MaterialStatus[] = ["pendiente_produccion", "pendiente_recepcion", "recibido", "preparado", "enviado", "agotado", "activo"];
const empty: Partial<Material> = { name: "", materialCode: "", clientId: "", type: "generico", status: "activo", unit: "ud", currentStock: 0, minimumStock: 0 };

export default function MaterialesPage() {
  const { can, user, refreshData } = useSession();
  const { data: materials } = useData(() => materialsService.list(), []);
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Material>>(empty);
  const [errors, setErrors] = useState<string[]>([]);

  // Ajuste manual de stock
  const [adjust, setAdjust] = useState<{ material: Material; delta: number; reason: string } | null>(null);

  if (!can("materials.view")) return <NoAccess />;
  const canManage = can("materials.manage");
  const canAdjust = can("stock.adjust");

  function create() { setForm(empty); setErrors([]); setOpen(true); }
  function edit(m: Material) { setForm(m); setErrors([]); setOpen(true); }

  async function save() {
    const result = validate(
      required(form.name, "Nombre"), required(form.materialCode, "Codigo"), required(form.clientId, "Cliente"),
      nonNegative(Number(form.currentStock ?? 0), "Stock actual"), nonNegative(Number(form.minimumStock ?? 0), "Stock minimo")
    );
    if (!result.valid) return setErrors(result.errors);
    const payload = {
      clientId: form.clientId!,
      campaignId: form.campaignId ?? null,
      name: form.name!.trim(),
      materialCode: form.materialCode!.trim(),
      type: (form.type as MaterialType) ?? "generico",
      description: form.description ?? null,
      dimensions: form.dimensions ?? null,
      heightCm: form.heightCm != null ? Number(form.heightCm) : null,
      widthCm: form.widthCm != null ? Number(form.widthCm) : null,
      unit: form.unit ?? "ud",
      currentStock: Number(form.currentStock ?? 0),
      reservedStock: Number(form.reservedStock ?? 0),
      minimumStock: Number(form.minimumStock ?? 0),
      location: form.location ?? null,
      status: (form.status as MaterialStatus) ?? "activo"
    };
    if (form.id) await materialsService.update(form.id, payload, user?.id);
    else await materialsService.create(payload, user?.id);
    setOpen(false);
    refreshData();
  }

  async function remove(m: Material) {
    if (!window.confirm(`Eliminar material ${m.name}?`)) return;
    await materialsService.remove(m.id);
    refreshData();
  }

  async function saveAdjust() {
    if (!adjust) return;
    try {
      await applyStockDelta({
        materialId: adjust.material.id,
        delta: adjust.delta,
        type: "ajuste",
        reason: adjust.reason || "Ajuste manual de stock",
        relatedEntityType: "ajuste_manual",
        actorId: user?.id
      });
      setAdjust(null);
      refreshData();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error al ajustar stock");
    }
  }

  const campaignsForClient = catalog.campaigns.filter((c) => !form.clientId || c.clientId === form.clientId);

  return (
    <div>
      <MaterialsTabs />
      <PageHeader
        title="Materiales"
        subtitle="Inventario de materiales con stock, minimos y estado."
        actions={canManage ? <Button onClick={create}>+ Nuevo material</Button> : undefined}
      />

      {!materials?.length ? (
        <EmptyState message="No hay materiales." />
      ) : (
        <Table headers={["Material", "Cliente", "Tipo", "Medidas", "Stock (fisico / reservado / disp.)", "Estado", ""]}>
          {materials.map((m) => {
            const avail = availableStock(m);
            const low = avail <= m.minimumStock;
            return (
              <tr key={m.id} className={low ? "bg-red-50/40" : ""}>
                <Td className="font-medium">
                  {m.name}
                  <div className="font-mono text-xs text-gray-400">{m.materialCode}</div>
                </Td>
                <Td>{catalog.clientName(m.clientId)}</Td>
                <Td className="capitalize">{m.type}</Td>
                <Td className="text-xs text-gray-500">{m.dimensions || (m.widthCm && m.heightCm ? `${m.widthCm}x${m.heightCm} cm` : "-")}</Td>
                <Td>
                  <span className="font-medium">{m.currentStock}</span>
                  <span className="text-xs text-blue-600"> / {m.reservedStock ?? 0} res</span>
                  <span className={low ? "font-semibold text-red-600" : "text-green-700"}> / {avail} disp</span>
                  <span className="text-xs text-gray-400"> (min {m.minimumStock})</span>
                </Td>
                <Td><Badge tone={materialStatusMeta[m.status].tone}>{materialStatusMeta[m.status].label}</Badge></Td>
                <Td>
                  <div className="flex gap-2">
                    {canAdjust ? <Button variant="secondary" onClick={() => setAdjust({ material: m, delta: 0, reason: "" })}>Ajustar</Button> : null}
                    {canManage ? <Button variant="secondary" onClick={() => edit(m)}>Editar</Button> : null}
                    {canManage ? <Button variant="danger" onClick={() => remove(m)}>Eliminar</Button> : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}

      {/* Modal material */}
      <Modal title={form.id ? "Editar material" : "Nuevo material"} open={open} onClose={() => setOpen(false)} wide>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><ErrorText errors={errors} /></div>
          <Field label="Nombre"><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Codigo"><Input value={form.materialCode ?? ""} onChange={(e) => setForm({ ...form, materialCode: e.target.value })} /></Field>
          <Field label="Cliente / CECO">
            <Select value={form.clientId ?? ""} onChange={(e) => setForm({ ...form, clientId: e.target.value, campaignId: null })}>
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
          <Field label="Tipo">
            <Select value={form.type ?? "generico"} onChange={(e) => setForm({ ...form, type: e.target.value as MaterialType })}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Unidad"><Input value={form.unit ?? "ud"} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
          <Field label="Dimensiones (texto)"><Input value={form.dimensions ?? ""} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} /></Field>
          <Field label="Ubicacion"><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Ancho (cm) - ISDIN">
            <Input type="number" value={form.widthCm ?? ""} onChange={(e) => setForm({ ...form, widthCm: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Alto (cm) - ISDIN">
            <Input type="number" value={form.heightCm ?? ""} onChange={(e) => setForm({ ...form, heightCm: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Stock actual" hint={form.id ? "Editar aqui NO genera movimiento. Usa 'Ajustar' para trazabilidad." : undefined}>
            <Input type="number" value={form.currentStock ?? 0} onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })} />
          </Field>
          <Field label="Stock minimo">
            <Input type="number" value={form.minimumStock ?? 0} onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) })} />
          </Field>
          <Field label="Estado">
            <Select value={form.status ?? "activo"} onChange={(e) => setForm({ ...form, status: e.target.value as MaterialStatus })}>
              {statuses.map((s) => <option key={s} value={s}>{materialStatusMeta[s].label}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Descripcion"><Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal ajuste stock */}
      <Modal title="Ajustar stock" open={!!adjust} onClose={() => setAdjust(null)}>
        {adjust ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              {adjust.material.name} — stock actual <strong>{adjust.material.currentStock}</strong>
            </p>
            <Field label="Delta (+/-)" hint="Ejemplo: -3 para restar 3, 10 para sumar 10. Genera un movimiento de tipo ajuste.">
              <Input type="number" value={adjust.delta} onChange={(e) => setAdjust({ ...adjust, delta: Number(e.target.value) })} />
            </Field>
            <Field label="Motivo">
              <Input value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAdjust(null)}>Cancelar</Button>
              <Button onClick={saveAdjust} disabled={adjust.delta === 0}>Aplicar</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
