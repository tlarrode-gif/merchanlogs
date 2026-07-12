"use client";

/**
 * Picking móvil: checklist táctil para el equipo de almacén desde el teléfono.
 *
 *  - Lista de pickings abiertos como tarjetas grandes; al abrir uno, una
 *    tarjeta por línea: UN TOQUE marca la línea completa como recogida (otro
 *    toque la desmarca); "Problema" abre una hoja con motivos rápidos, unidades
 *    recogidas parciales y comentario, crea la incidencia y marca la línea.
 *  - "Cerrar picking" aparece cuando no quedan líneas sin resolver y usa el
 *    comando atómico del DB (descuento de stock exacto, imposible cerrar dos
 *    veces) — closePickingBatch ya delega en él en modo Supabase.
 *  - Sin sidebar ni topbar (el shell renderiza esta ruta a pantalla completa).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CircleAlert, LogOut, RefreshCw } from "lucide-react";
import { PickingBatch, PickingLine } from "@/types";
import { useSession } from "@/components/session-provider";
import { getAdapter } from "@/services/adapter";
import { closePickingBatch, flagLine, prepareLine } from "@/services/picking.service";
import { createIncident, nextIncidentCode } from "@/services/incidents.service";
import { logout } from "@/services/session";

const OPEN_STATUSES = ["pendiente_preparacion", "en_preparacion", "preparado_completo", "con_incidencia", "bloqueado"];

type Sheet = { batch: PickingBatch; line: PickingLine } | null;

export default function PickingMovilPage() {
  const { user, loading: sessionLoading } = useSession();
  const [batches, setBatches] = useState<PickingBatch[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAdapter().list("pickingBatches");
      setBatches(all.filter((b) => OPEN_STATUSES.includes(b.status)));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el picking");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const open = useMemo(() => batches.find((b) => b.id === openId) ?? null, [batches, openId]);

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 2500);
  }

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
  }

  async function toggleLine(batch: PickingBatch, line: PickingLine) {
    if (busyLine) return;
    setBusyLine(line.id);
    setError("");
    try {
      // Un toque = línea completa; otro toque = vuelve a pendiente.
      const done = line.status === "preparado";
      const updated = await prepareLine(batch.id, line.id, done ? 0 : undefined, user?.id ?? null);
      setBatches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      fail(err, "No se pudo actualizar la línea");
    } finally {
      setBusyLine(null);
    }
  }

  async function reportProblem(batch: PickingBatch, line: PickingLine, motivo: "falta" | "danado" | "medidas", picked: number, comment: string) {
    setBusyLine(line.id);
    setError("");
    try {
      const incident = await createIncident({
        incidentCode: await nextIncidentCode(),
        title: motivo === "falta" ? `Falta material en ${batch.pickingCode}` : motivo === "danado" ? `Material dañado en ${batch.pickingCode}` : `Medidas incorrectas en ${batch.pickingCode}`,
        description: [comment.trim(), picked > 0 ? `Unidades recogidas: ${picked} de ${line.quantity}` : ""].filter(Boolean).join(" · ") || null,
        materialId: line.materialId ?? null,
        materialItemId: line.materialItemId ?? null,
        pickingBatchId: batch.id,
        pickingLineId: line.id,
        clientId: batch.clientId ?? null,
        campaignId: batch.campaignId ?? null,
        type: motivo === "danado" ? "rotura" : motivo === "medidas" ? "medidas_incorrectas" : "material_faltante",
        severity: "media",
        status: "abierta",
        blocksPicking: false
      } as never, user?.id ?? null);
      // Si recogieron parte, se registra antes de marcar el problema (el cierre
      // NO descuenta líneas faltantes: esas unidades vuelven a la estantería).
      if (picked > 0) await prepareLine(batch.id, line.id, picked, user?.id ?? null);
      const updated = await flagLine(batch.id, line.id, motivo === "falta" ? "faltante" : "incidencia", incident.id, user?.id ?? null);
      setBatches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSheet(null);
      flash(`Problema registrado (${incident.incidentCode})`);
    } catch (err) {
      fail(err, "No se pudo registrar el problema");
    } finally {
      setBusyLine(null);
    }
  }

  async function closeBatch(batch: PickingBatch) {
    if (!window.confirm(`Cerrar ${batch.pickingCode}: se descuenta el stock de lo recogido. ¿Continuar?`)) return;
    setClosing(true);
    setError("");
    try {
      const result = await closePickingBatch(batch.id, user?.id ?? null);
      flash(`${batch.pickingCode} cerrado · ${result.consumedUnits} unidades${result.partial ? " (parcial)" : ""}. Listo para envío.`);
      setOpenId(null);
      await refresh();
    } catch (err) {
      fail(err, "No se pudo cerrar el picking");
    } finally {
      setClosing(false);
    }
  }

  if (sessionLoading) return <Shell><p className="p-6 text-center text-sm text-slate-400">Cargando...</p></Shell>;

  // ------------------------- Detalle de un picking -------------------------
  if (open) {
    const lines = open.lines ?? [];
    const doneCount = lines.filter((l) => ["preparado", "faltante", "incidencia", "cancelada"].includes(l.status)).length;
    const resolved = lines.length > 0 && doneCount === lines.length;
    const pct = lines.length ? Math.round((doneCount / lines.length) * 100) : 0;
    return (
      <Shell>
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpenId(null)} className="rounded-xl border p-2" aria-label="Volver"><ArrowLeft className="h-5 w-5" /></button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold">{open.pickingCode}</p>
              <p className="truncate text-xs text-slate-500">{open.assignedInstaller || open.clientId || ""}</p>
            </div>
            <span className="text-sm font-bold text-slate-600">{doneCount}/{lines.length}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all ${resolved ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: `${pct}%` }} />
          </div>
        </header>

        {notice && <Toast tone="ok" text={notice} />}
        {error && <Toast tone="error" text={error} />}

        <div className="space-y-2.5 p-3 pb-32">
          {lines.map((line) => {
            const done = line.status === "preparado";
            const problem = line.status === "faltante" || line.status === "incidencia";
            const cancelled = line.status === "cancelada";
            return (
              <div key={line.id} className={`rounded-2xl border-2 bg-white p-1 transition-colors ${done ? "border-emerald-400 bg-emerald-50" : problem ? "border-amber-400 bg-amber-50" : cancelled ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
                <button
                  onClick={() => !cancelled && !problem && toggleLine(open, line)}
                  disabled={busyLine === line.id || cancelled || problem}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left active:bg-slate-50"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-emerald-500 bg-emerald-500 text-white" : problem ? "border-amber-500 bg-amber-500 text-white" : "border-slate-300 text-transparent"}`}>
                    {problem ? <CircleAlert className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-base font-semibold ${done ? "line-through decoration-emerald-500/60" : ""}`}>{line.description}</span>
                    <span className="block text-sm text-slate-500">
                      {line.quantity} ud{line.quantity === 1 ? "" : "s"}
                      {line.pointOfSaleName ? ` · ${line.pointOfSaleName}` : ""}
                      {problem ? ` · ${line.status === "faltante" ? "FALTA" : "INCIDENCIA"}${line.preparedQuantity > 0 ? ` (recogidas ${line.preparedQuantity})` : ""}` : ""}
                    </span>
                  </span>
                </button>
                {!done && !problem && !cancelled && (
                  <button onClick={() => setSheet({ batch: open, line })} className="mb-1 ml-[3.25rem] rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 active:bg-amber-100">
                    ⚠ Problema con este material
                  </button>
                )}
              </div>
            );
          })}
          {!lines.length && <p className="p-6 text-center text-sm text-slate-400">Este picking no tiene líneas.</p>}
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-3 pb-5">
          <button
            onClick={() => closeBatch(open)}
            disabled={!resolved || closing}
            className="w-full rounded-2xl bg-emerald-600 py-4 text-lg font-extrabold text-white shadow-lg active:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {closing ? "Cerrando..." : resolved ? "✓ Cerrar picking" : `Faltan ${lines.length - doneCount} línea${lines.length - doneCount === 1 ? "" : "s"}`}
          </button>
        </div>

        {sheet && <ProblemSheet sheet={sheet} busy={busyLine === sheet.line.id} onClose={() => setSheet(null)} onSubmit={reportProblem} />}
      </Shell>
    );
  }

  // ------------------------- Lista de pickings -------------------------
  return (
    <Shell>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
        <div>
          <p className="text-lg font-extrabold">Picking <span className="text-blue-600">móvil</span></p>
          <p className="text-xs text-slate-500">{user?.displayName ?? ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void refresh()} className="rounded-xl border p-2.5" aria-label="Actualizar"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button>
          <button onClick={() => void logout()} className="rounded-xl border p-2.5" aria-label="Salir"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>

      {notice && <Toast tone="ok" text={notice} />}
      {error && <Toast tone="error" text={error} />}

      <div className="space-y-2.5 p-3">
        {loading && !batches.length && <p className="p-6 text-center text-sm text-slate-400">Cargando pickings...</p>}
        {!loading && !batches.length && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-400">
            No hay pickings pendientes. 🎉
          </div>
        )}
        {batches.map((b) => {
          const lines = b.lines ?? [];
          const doneCount = lines.filter((l) => ["preparado", "faltante", "incidencia", "cancelada"].includes(l.status)).length;
          return (
            <button key={b.id} onClick={() => setOpenId(b.id)} className="block w-full rounded-2xl border-2 border-slate-200 bg-white p-4 text-left active:border-blue-400">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-base font-extrabold">{b.pickingCode}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${b.status === "con_incidencia" ? "bg-amber-100 text-amber-800" : b.status === "preparado_completo" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                  {doneCount}/{lines.length}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">
                {[b.assignedInstaller, b.province, `${lines.length} línea${lines.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
              </p>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 text-slate-900">{children}</div>;
}

function Toast({ tone, text }: { tone: "ok" | "error"; text: string }) {
  return (
    <div className={`mx-3 mt-3 rounded-2xl border p-3 text-sm font-semibold ${tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
      {text}
    </div>
  );
}

function ProblemSheet({ sheet, busy, onClose, onSubmit }: {
  sheet: NonNullable<Sheet>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (batch: PickingBatch, line: PickingLine, motivo: "falta" | "danado" | "medidas", picked: number, comment: string) => void;
}) {
  const [motivo, setMotivo] = useState<"falta" | "danado" | "medidas">("falta");
  const [picked, setPicked] = useState(0);
  const [comment, setComment] = useState("");
  const { line, batch } = sheet;
  const motivos = [
    ["falta", "Falta material"],
    ["danado", "Material dañado"],
    ["medidas", "Medidas incorrectas"]
  ] as const;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
        <p className="text-base font-bold">Problema con: {line.description}</p>
        <p className="mb-3 text-sm text-slate-500">Pedidas {line.quantity} unidades</p>
        <div className="mb-3 grid gap-2">
          {motivos.map(([value, label]) => (
            <button key={value} onClick={() => setMotivo(value)} className={`rounded-2xl border-2 p-3 text-left text-sm font-semibold ${motivo === value ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>
        <label className="mb-3 block text-sm">
          <span className="font-semibold">¿Cuántas unidades SÍ llevas? (0 si ninguna)</span>
          <input type="number" inputMode="numeric" min={0} max={line.quantity} value={picked}
            onChange={(e) => setPicked(Math.max(0, Math.min(line.quantity, Number(e.target.value) || 0)))}
            className="mt-1 w-full rounded-2xl border-2 border-slate-200 p-3 text-base" />
        </label>
        <label className="mb-4 block text-sm">
          <span className="font-semibold">Comentario (opcional)</span>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 w-full rounded-2xl border-2 border-slate-200 p-3 text-base" />
        </label>
        <div className="flex gap-2">
          <button onClick={onClose} className="w-full rounded-2xl border-2 border-slate-200 py-3 font-bold">Cancelar</button>
          <button disabled={busy} onClick={() => onSubmit(batch, line, motivo, picked, comment)} className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">
            {busy ? "Guardando..." : "Registrar problema"}
          </button>
        </div>
      </div>
    </div>
  );
}
