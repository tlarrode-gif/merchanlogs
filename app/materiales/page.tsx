"use client";

/**
 * Materiales · Catalogo (rediseño): materiales con stock agregado. Tabla
 * maestro-detalle: al seleccionar un material se abre el panel lateral con su
 * trazabilidad (desglose de stock, movimientos recientes y donde se esta
 * usando), ademas de las acciones de siempre (ajustar, editar, eliminar).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Boxes, ChevronRight, PackageMinus, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Material, MaterialType, MaterialStatus } from "@/types";
import { materialsService } from "@/services/catalog.service";
import { applyStockDelta, availableStock } from "@/services/stock.service";
import { getAdapter } from "@/services/adapter";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import { useCatalog } from "@/components/use-catalog";
import { Chip, Empty, Kpi, PageHeader, Panel, Progress } from "@/components/lg";
import { Button, ErrorText, Field, Input, Modal, NoAccess, Select, Textarea } from "@/components/ui";
import { materialStatusMeta, movementTypeMeta, pickingBatchStatusMeta, requestStatusMeta } from "@/lib/status";
import { formatDateTime } from "@/lib/dates";
import { required, validate, nonNegative } from "@/lib/validation";
import { MaterialsTabs } from "@/components/materials-tabs";

const types: MaterialType[] = ["vinilo", "plv", "display", "carteleria", "muestra", "promocional", "generico", "otro"];
const statuses: MaterialStatus[] = ["pendiente_produccion", "pendiente_recepcion", "recibido", "preparado", "enviado", "agotado", "activo"];
const empty: Partial<Material> = { name: "", materialCode: "", clientId: "", type: "generico", status: "activo", unit: "ud", currentStock: 0, minimumStock: 0 };

export default function MaterialesPage() {
  const { can, user, refreshData } = useSession();
  const search = useSearchParams();
  const { data } = useData(async () => {
    const adapter = getAdapter();
    const [materials, movements, requests, pickings] = await Promise.all([
      materialsService.list(),
      adapter.list("stockMovements"),
      adapter.list("logisticsRequests"),
      adapter.list("pickingBatches")
    ]);
    return { materials, movements, requests, pickings };
  }, []);
  const { catalog } = useCatalog();

  const [q, setQ] = useState(search.get("q") ?? "");
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Material>>(empty);
  const [errors, setErrors] = useState<string[]>([]);
  const [adjust, setAdjust] = useState<{ material: Material; delta: number; reason: string } | null>(null);

  const materials = useMemo(() => data?.materials ?? [], [data]);
  const filtered = useMemo(
    () =>
      materials.filter((m) => {
        const text = `${m.name} ${m.materialCode} ${m.dimensions ?? ""}`.toLowerCase();
        return (
          (!q || text.includes(q.toLowerCase())) &&
          (!clientId || m.clientId === clientId) &&
          (!type || m.type === type) &&
          (!onlyLow || availableStock(m) <= m.minimumStock)
        );
      }),
    [materials, q, clientId, type, onlyLow]
  );

  const selected = filtered.find((m) => m.id === selectedId) ?? null;

  if (!can("materials.view")) return <NoAccess />;
  const canManage = can("materials.manage");
  const canAdjust = can("stock.adjust");

  const totals = {
    fisico: materials.reduce((s, m) => s + (m.currentStock ?? 0), 0),
    reservado: materials.reduce((s, m) => s + (m.reservedStock ?? 0), 0),
    bajoMinimo: materials.filter((m) => availableStock(m) <= m.minimumStock).length
  };

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
    setSelectedId(null);
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

  // Trazabilidad del material seleccionado
  const trace = selected && data
    ? {
        movements: data.movements.filter((mv) => mv.materialId === selected.id).slice(0, 6),
        requests: data.requests.filter((r) => r.materials.some((l) => l.materialId === selected.id) && !["entregada", "cancelada"].includes(r.status)),
        pickings: data.pickings.filter((p) => p.lines.some((l) => l.materialId === selected.id) && !["cerrado", "enviado", "cancelado"].includes(p.status))
      }
    : null;

  return (
    <div className="space-y-4">
      <MaterialsTabs />
      <PageHeader
        title="Catálogo de materiales"
        subtitle="Materiales con stock por cantidades (el seguimiento pieza a pieza está en la pestaña Piezas VIN)"
        actions={canManage ? (
          <button className="lg-btn lg-btn-primary" onClick={create}>
            <Plus className="h-4 w-4" /> Nuevo material
          </button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Materiales" value={materials.length} icon={<Boxes className="h-4 w-4" />} />
        <Kpi label="Stock físico total" value={totals.fisico} hint="unidades en almacén" />
        <Kpi label="Reservado" value={totals.reservado} tone="blue" hint="comprometido en pickings" />
        <Kpi label="Bajo mínimo" value={totals.bajoMinimo} tone={totals.bajoMinimo ? "danger" : "ok"} icon={<PackageMinus className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="lg-input pl-9" placeholder="Buscar material o código..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="lg-select w-44" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {catalog.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="lg-select w-40" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {types.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <button
          className={`lg-btn lg-btn-sm ${onlyLow ? "lg-btn-danger" : "lg-btn-outline"}`}
          onClick={() => setOnlyLow((v) => !v)}
          title="Mostrar solo materiales con stock disponible por debajo del mínimo"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Bajo mínimo
        </button>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title={`Mostrando ${filtered.length} de ${materials.length} materiales`}>
          {!filtered.length ? (
            <Empty>No hay materiales con estos filtros.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="lg-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Cliente</th>
                    <th>Tipo / Medidas</th>
                    <th>Físico</th>
                    <th>Reserv.</th>
                    <th>Disponible</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const avail = availableStock(m);
                    const low = avail <= m.minimumStock;
                    return (
                      <tr key={m.id} className={`cursor-pointer ${selected?.id === m.id ? "lg-row-active" : ""}`} onClick={() => setSelectedId(m.id)}>
                        <td>
                          <p className="font-semibold">{m.name}</p>
                          <p className="font-mono text-[10px] text-slate-400">{m.materialCode}</p>
                        </td>
                        <td className="text-xs">{catalog.clientName(m.clientId)}</td>
                        <td className="text-xs capitalize text-slate-500">
                          {m.type}
                          {(m.dimensions || (m.widthCm && m.heightCm)) && (
                            <p className="text-[10px]">{m.dimensions || `${m.widthCm}x${m.heightCm} cm`}</p>
                          )}
                        </td>
                        <td className="text-sm font-semibold">{m.currentStock}</td>
                        <td className="text-sm text-blue-600">{m.reservedStock ?? 0}</td>
                        <td>
                          <span className={`text-sm font-bold ${low ? "text-red-600" : "text-emerald-600"}`}>{avail}</span>
                          <span className="text-[10px] text-slate-400"> / min {m.minimumStock}</span>
                        </td>
                        <td><Chip tone={materialStatusMeta[m.status].tone}>{materialStatusMeta[m.status].label}</Chip></td>
                        <td><ChevronRight className="h-4 w-4 text-blue-500" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {selected && trace && (
          <Panel
            title={<span className="min-w-0 truncate">{selected.name}</span>}
            actions={<Chip tone={materialStatusMeta[selected.status].tone}>{materialStatusMeta[selected.status].label}</Chip>}
            className="xl:sticky xl:top-16"
          >
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[10px] text-slate-400">{selected.materialCode} · {catalog.clientName(selected.clientId)}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-lg font-extrabold">{selected.currentStock}</p>
                    <p className="lg-kpi-label">Físico</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-2">
                    <p className="text-lg font-extrabold text-blue-700">{selected.reservedStock ?? 0}</p>
                    <p className="lg-kpi-label">Reservado</p>
                  </div>
                  <div className={`rounded-xl p-2 ${availableStock(selected) <= selected.minimumStock ? "bg-red-50" : "bg-emerald-50"}`}>
                    <p className={`text-lg font-extrabold ${availableStock(selected) <= selected.minimumStock ? "text-red-700" : "text-emerald-700"}`}>
                      {availableStock(selected)}
                    </p>
                    <p className="lg-kpi-label">Disponible</p>
                  </div>
                </div>
                <div className="mt-2">
                  <Progress
                    value={selected.currentStock ? ((selected.reservedStock ?? 0) / selected.currentStock) * 100 : 0}
                    tone="blue"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Parte azul = comprometido en pickings abiertos · mínimo {selected.minimumStock} {selected.unit}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {canAdjust && (
                  <button className="lg-btn lg-btn-blue lg-btn-sm" onClick={() => setAdjust({ material: selected, delta: 0, reason: "" })}>Ajustar stock</button>
                )}
                {canManage && <button className="lg-btn lg-btn-outline lg-btn-sm" onClick={() => edit(selected)}>Editar</button>}
                {canManage && <button className="lg-btn lg-btn-outline lg-btn-sm text-red-600" onClick={() => remove(selected)}>Eliminar</button>}
              </div>

              <div>
                <p className="lg-kpi-label mb-2">Se está usando en</p>
                {!trace.requests.length && !trace.pickings.length ? (
                  <p className="text-xs text-slate-400">Sin peticiones ni pickings abiertos con este material.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {trace.requests.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <Link href={`/peticiones?id=${r.id}`} className="font-semibold text-blue-700 hover:underline">{r.requestCode}</Link>
                        <Chip tone={requestStatusMeta[r.status].tone}>{requestStatusMeta[r.status].label}</Chip>
                      </li>
                    ))}
                    {trace.pickings.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <Link href={`/picking?id=${p.id}`} className="font-semibold text-blue-700 hover:underline">{p.pickingCode}</Link>
                        <Chip tone={pickingBatchStatusMeta[p.status].tone}>{pickingBatchStatusMeta[p.status].label}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="lg-kpi-label mb-2">Últimos movimientos</p>
                {!trace.movements.length ? (
                  <p className="text-xs text-slate-400">Sin movimientos registrados.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {trace.movements.map((mv) => (
                      <li key={mv.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0">
                          <Chip tone={movementTypeMeta[mv.type].tone}>{movementTypeMeta[mv.type].label}</Chip>
                          <span className="ml-1.5 font-semibold">
                            {movementTypeMeta[mv.type].sign === -1 ? "−" : movementTypeMeta[mv.type].sign === 1 ? "+" : ""}
                            {mv.quantity}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatDateTime(mv.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/movimientos" className="mt-1 inline-block text-[11px] font-semibold text-blue-600 hover:underline">
                  Ver todos los movimientos →
                </Link>
              </div>
            </div>
          </Panel>
        )}
      </div>

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
