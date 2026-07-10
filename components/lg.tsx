"use client";

/**
 * Kit de componentes del rediseño MerchanLOGS (mockups UI_LOGS 2026-07).
 * Piezas: KPI cards, chips de estado/prioridad, barras de progreso, donut,
 * mini grafico de barras, cabecera de pagina y estados vacios.
 */

import { ReactNode } from "react";

// ---------------------------------------------------------------------------
// KPI card (fila superior de cada pantalla)
// ---------------------------------------------------------------------------

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
  icon
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "blue" | "danger" | "ok" | "warn";
  icon?: ReactNode;
}) {
  const valueColor =
    tone === "blue" ? "text-blue-600" : tone === "danger" ? "text-red-600" : tone === "ok" ? "text-green-600" : tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="lg-card flex items-start justify-between gap-2 p-4">
      <div className="min-w-0">
        <p className="lg-kpi-label">{label}</p>
        <p className={`mt-1 text-3xl font-extrabold leading-none ${valueColor}`}>{value}</p>
        {hint && <p className="mt-1.5 truncate text-xs text-slate-400">{hint}</p>}
      </div>
      {icon && <div className="shrink-0 rounded-xl bg-slate-50 p-2 text-slate-500">{icon}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chips de estado y prioridad
// ---------------------------------------------------------------------------

const chipTones: Record<string, string> = {
  gray: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-700",
  cyan: "bg-cyan-50 text-cyan-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
  dark: "bg-slate-900 text-white"
};

export function Chip({ tone = "gray", children }: { tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chipTones[tone] ?? chipTones.gray}`}>
      {children}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: string }) {
  const tone = priority === "urgente" ? "red" : priority === "alta" ? "amber" : priority === "baja" ? "gray" : "blue";
  const label = priority === "urgente" ? "CRÍTICA" : priority.toUpperCase();
  return <Chip tone={tone}>{label}</Chip>;
}

// ---------------------------------------------------------------------------
// Barras y donut (sin dependencias)
// ---------------------------------------------------------------------------

export function Progress({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "red" | "dark" }) {
  const bg = tone === "green" ? "#16a34a" : tone === "red" ? "#dc2626" : tone === "dark" ? "#0f172a" : "#3b82f6";
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: bg }} />
    </div>
  );
}

/** Mini grafico de barras verticales (evolucion / carga semanal). */
export function Bars({ data, height = 140 }: { data: Array<{ label: string; value: number; soft?: boolean }>; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div
            className="w-full rounded-t-md"
            style={{ height: `${Math.max(4, (d.value / max) * (height - 28))}px`, background: d.soft ? "#93c5fd" : "#2563eb" }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="max-w-full truncate text-[9px] font-semibold uppercase text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Donut con leyenda (incidencias por tipo, estado de servicios...). */
export function Donut({
  data,
  centerLabel,
  size = 150
}: {
  data: Array<{ label: string; value: number; color: string }>;
  centerLabel?: string;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const stops = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const from = (acc / Math.max(1, total)) * 360;
      acc += d.value;
      const to = (acc / Math.max(1, total)) * 360;
      return `${d.color} ${from}deg ${to}deg`;
    })
    .join(", ");
  return (
    <div className="flex items-center gap-5">
      <div
        className="relative shrink-0 rounded-full"
        style={{ width: size, height: size, background: total ? `conic-gradient(${stops})` : "#e5e7eb" }}
      >
        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-2xl font-extrabold">{centerLabel ?? total}</span>
          <span className="text-[9px] font-bold uppercase text-slate-400">total</span>
        </div>
      </div>
      <ul className="min-w-0 space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate text-slate-600">{d.label}</span>
            </span>
            <b>{d.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cabecera de pagina y bloques
// ---------------------------------------------------------------------------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-blue-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`lg-card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">{children}</div>;
}

/** Chips de severidad de alertas (CRÍTICA / ALTA / MEDIA) de los mockups. */
export function SeverityChip({ level }: { level: "critica" | "alta" | "media" | "baja" }) {
  const tone = level === "critica" ? "red" : level === "alta" ? "amber" : level === "media" ? "blue" : "gray";
  return <Chip tone={tone}>{level.toUpperCase()}</Chip>;
}
