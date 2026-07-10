"use client";

/**
 * Pagina de diagnostico de la conexion a Supabase.
 *
 * Muestra la configuracion efectiva del build (variables NEXT_PUBLIC_* que
 * quedaron incrustadas al compilar) y ejecuta consultas reales de prueba
 * contra las tablas clave, mostrando el resultado o el error exacto de cada
 * una. Pensada para verificar un despliegue sin abrir la consola del navegador.
 */

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { DATA_SOURCE } from "@/components/connection-status";

interface TableCheck {
  table: string;
  label: string;
  status: "pending" | "ok" | "error";
  detail: string;
}

const TABLES_TO_CHECK: Array<{ table: string; label: string }> = [
  { table: "clients", label: "Clientes (maestro OPS)" },
  { table: "logistics_materials", label: "Materiales" },
  { table: "logistics_stock", label: "Stock" },
  { table: "logistics_requests", label: "Peticiones logisticas" },
  { table: "logistics_pickings", label: "Pickings" },
  { table: "logistics_shipments", label: "Envios" },
  { table: "logistics_incidents", label: "Incidencias" }
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function ConfigRow({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={`text-right font-mono text-xs ${ok ? "text-green-700" : "text-red-600"}`}>{value}</span>
    </div>
  );
}

export default function EstadoPage() {
  const [checks, setChecks] = useState<TableCheck[]>(
    TABLES_TO_CHECK.map((t) => ({ ...t, status: "pending", detail: "..." }))
  );

  const supabaseMode = DATA_SOURCE === "supabase";

  useEffect(() => {
    if (!supabaseMode || !isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    TABLES_TO_CHECK.forEach(({ table }) => {
      supabase!
        .from(table)
        .select("id", { count: "exact", head: true })
        .then(({ count, error }) => {
          if (cancelled) return;
          setChecks((prev) =>
            prev.map((c) =>
              c.table === table
                ? error
                  ? { ...c, status: "error", detail: error.message }
                  : { ...c, status: "ok", detail: `${count ?? 0} filas` }
                : c
            )
          );
        });
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseMode]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Estado de la conexion</h1>
        <p className="text-sm text-gray-500">
          Diagnostico del origen de datos activo en este despliegue.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Configuracion del build</h2>
        <ConfigRow
          label="NEXT_PUBLIC_DATA_SOURCE"
          ok={supabaseMode}
          value={process.env.NEXT_PUBLIC_DATA_SOURCE || "(no definida → datos locales)"}
        />
        <ConfigRow
          label="NEXT_PUBLIC_SUPABASE_URL"
          ok={Boolean(supabaseUrl)}
          value={supabaseUrl || "(no definida)"}
        />
        <ConfigRow
          label="NEXT_PUBLIC_SUPABASE_ANON_KEY"
          ok={Boolean(anonKey)}
          value={anonKey ? `definida (${anonKey.slice(0, 8)}...${anonKey.slice(-4)})` : "(no definida)"}
        />
        {!supabaseMode && (
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-700">
            La app esta funcionando con datos locales. Si esperabas Supabase, revisa que la variable
            NEXT_PUBLIC_DATA_SOURCE tenga exactamente el valor <code className="font-mono">supabase</code> (en
            minusculas) en Vercel y que se haya hecho un redeploy DESPUES de guardarla: las variables solo se
            aplican al reconstruir la app.
          </p>
        )}
        {supabaseMode && !isSupabaseConfigured && (
          <p className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-700">
            El modo Supabase esta activo pero faltan la URL o la clave. Revisa las variables en Vercel y redeploya.
          </p>
        )}
      </section>

      {supabaseMode && isSupabaseConfigured && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Pruebas de lectura en vivo</h2>
          {checks.map((c) => (
            <div key={c.table} className="flex items-start justify-between gap-4 border-b border-gray-100 py-2 text-sm">
              <span className="text-gray-600">
                {c.label} <span className="font-mono text-xs text-gray-400">({c.table})</span>
              </span>
              <span
                className={`text-right text-xs ${
                  c.status === "ok" ? "text-green-700" : c.status === "error" ? "text-red-600" : "text-gray-400"
                }`}
              >
                {c.status === "ok" ? "✓ " : c.status === "error" ? "✗ " : ""}
                {c.detail}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
