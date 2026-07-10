"use client";

/**
 * Configuracion del Sistema (mockup image12): panel de administracion con
 * reglas de alerta (persistidas en localStorage por ahora), y vocabularios de
 * estados/tipos del dominio en solo lectura. La ejecucion automatica de las
 * reglas llegara con el backend de notificaciones.
 */

import { useEffect, useState } from "react";
import { BellRing, Cog, ShieldCheck } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Chip, Kpi, PageHeader, Panel } from "@/components/lg";
import { NoAccess } from "@/components/ui";
import {
  incidentStatusMeta,
  materialItemStatusMeta,
  pickingBatchStatusMeta,
  requestStatusMeta,
  shipmentStatusMeta
} from "@/lib/status";

interface AlertRule {
  id: string;
  title: string;
  description: string;
  priority: "critica" | "alta" | "media";
  enabled: boolean;
}

const DEFAULT_RULES: AlertRule[] = [
  {
    id: "material-confirmado",
    title: "Material Confirmado",
    description: "Avisar si no hay material confirmado 48h antes del envío programado.",
    priority: "alta",
    enabled: true
  },
  {
    id: "tracking-envio",
    title: "Tracking de Envío",
    description: "Avisar si el envío no tiene número de tracking asignado tras 12h de la salida.",
    priority: "media",
    enabled: true
  },
  {
    id: "reproduccion-urgente",
    title: "Reproducción Urgente",
    description: "Notificar inmediatamente después del registro de una reproducción crítica.",
    priority: "critica",
    enabled: false
  },
  {
    id: "stock-minimo",
    title: "Stock bajo mínimo",
    description: "Avisar cuando el stock disponible de un material caiga por debajo del mínimo.",
    priority: "alta",
    enabled: true
  }
];

const STORAGE_KEY = "merchanlogs.alert-rules.v1";

export default function ConfiguracionPage() {
  const { can, user } = useSession();
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_RULES);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setRules(JSON.parse(raw) as AlertRule[]);
    } catch {
      /* semilla por defecto */
    }
  }, []);

  if (!can("requests.manage")) return <NoAccess />;

  function toggle(id: string) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    setDirty(true);
  }

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    setDirty(false);
    setSavedAt(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
  }

  function discard() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setRules(raw ? (JSON.parse(raw) as AlertRule[]) : DEFAULT_RULES);
    } catch {
      setRules(DEFAULT_RULES);
    }
    setDirty(false);
  }

  const active = rules.filter((r) => r.enabled).length;

  const vocabularies: Array<{ title: string; entries: Array<{ label: string; tone: string }> }> = [
    { title: "Estados de petición", entries: Object.values(requestStatusMeta).map((m) => ({ label: m.label, tone: m.tone })) },
    { title: "Estados de picking", entries: Object.values(pickingBatchStatusMeta).map((m) => ({ label: m.label, tone: m.tone })) },
    { title: "Estados de envío", entries: Object.values(shipmentStatusMeta).map((m) => ({ label: m.label, tone: m.tone })) },
    { title: "Estados de incidencia", entries: Object.values(incidentStatusMeta).map((m) => ({ label: m.label, tone: m.tone })) },
    { title: "Estados de pieza (VIN)", entries: Object.values(materialItemStatusMeta).map((m) => ({ label: m.label, tone: m.tone })) }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Configuración del Sistema"
        subtitle="Parámetros críticos del flujo logístico y reglas de alerta"
        actions={
          <div className="flex gap-2">
            <button className="lg-btn lg-btn-outline" disabled={!dirty} onClick={discard}>Descartar cambios</button>
            <button className="lg-btn lg-btn-blue" disabled={!dirty} onClick={save}>Guardar configuración</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="Reglas activas" value={active} tone="blue" icon={<BellRing className="h-4 w-4" />} />
        <Kpi label="Reglas definidas" value={rules.length} icon={<Cog className="h-4 w-4" />} />
        <Kpi
          label="Último cambio"
          value={savedAt ?? "—"}
          hint={savedAt ? `Guardado por ${user?.displayName ?? "admin"}` : "Sin cambios en esta sesión"}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      <Panel title="Reglas de Alerta" actions={<Chip tone="blue">se aplican al guardar</Chip>}>
        <div className="grid gap-3 md:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule.id} className={`rounded-xl border p-3.5 ${rule.enabled ? "border-blue-200 bg-blue-50/30" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{rule.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{rule.description}</p>
                  <div className="mt-2">
                    <Chip tone={rule.priority === "critica" ? "red" : rule.priority === "alta" ? "amber" : "blue"}>
                      PRIORIDAD {rule.priority.toUpperCase()}
                    </Chip>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={rule.enabled}
                  onClick={() => toggle(rule.id)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${rule.enabled ? "bg-blue-600" : "bg-slate-200"}`}
                  title={rule.enabled ? "Desactivar" : "Activar"}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${rule.enabled ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Las reglas se guardan en este navegador. El envío automático de avisos (email/notificación) se activará en la fase de notificaciones del backend.
        </p>
      </Panel>

      <Panel title="Vocabularios del dominio (solo lectura)">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vocabularies.map((v) => (
            <div key={v.title}>
              <p className="lg-kpi-label mb-2">{v.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {v.entries.map((e) => (
                  <Chip key={e.label} tone={e.tone}>{e.label}</Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
