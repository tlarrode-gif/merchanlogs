"use client";

/**
 * Indicador vivo del origen de datos y del estado de la conexion a Supabase.
 *
 * - En modo local muestra un aviso ambar (comportamiento por defecto).
 * - En modo supabase hace una consulta minima real (count de materiales) y
 *   muestra verde si responde o rojo con el error exacto si falla. Es la
 *   herramienta de diagnostico para verificar el despliegue sin consola.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "local";

export type ConnectionState =
  | { status: "local" }
  | { status: "misconfigured"; detail: string }
  | { status: "checking" }
  | { status: "connected"; detail: string }
  | { status: "error"; detail: string };

export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(
    DATA_SOURCE === "local" ? { status: "local" } : { status: "checking" }
  );

  useEffect(() => {
    if (DATA_SOURCE === "local") return;
    if (!isSupabaseConfigured || !supabase) {
      const missing = [
        !process.env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : null,
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null
      ].filter(Boolean);
      setState({ status: "misconfigured", detail: `Faltan variables: ${missing.join(", ")}` });
      return;
    }
    let cancelled = false;
    supabase
      .from("logistics_materials")
      .select("id", { count: "exact", head: true })
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) setState({ status: "error", detail: error.message });
        else setState({ status: "connected", detail: `${count ?? 0} materiales` });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function ConnectionBadge() {
  const state = useConnectionState();

  const styles: Record<ConnectionState["status"], string> = {
    local: "text-amber-600",
    misconfigured: "text-red-600",
    checking: "text-gray-400",
    connected: "text-green-600",
    error: "text-red-600"
  };
  const labels: Record<ConnectionState["status"], string> = {
    local: "Datos locales (sin Supabase)",
    misconfigured: "Supabase activado pero mal configurado",
    checking: "Conectando con Supabase...",
    connected: "Conectado a Supabase",
    error: "Error de conexion con Supabase"
  };

  return (
    <Link href="/estado" className="text-sm text-gray-500 hover:underline" title="Ver diagnostico de conexion">
      Entorno: <span className={`font-medium ${styles[state.status]}`}>{labels[state.status]}</span>
    </Link>
  );
}
