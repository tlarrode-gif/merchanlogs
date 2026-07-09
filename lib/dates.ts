/** Utilidades de fecha. Todas las fechas se almacenan como ISO string. */

import { ISODateString } from "@/types/base";

export function nowIso(): ISODateString {
  return new Date().toISOString();
}

/** Formatea una fecha ISO a formato corto es-ES. Devuelve "-" si no hay valor. */
export function formatDate(value?: ISODateString | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatDateTime(value?: ISODateString | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Convierte un valor de <input type="date"> a ISO (o null). */
export function dateInputToIso(value: string): ISODateString | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Convierte ISO a valor apto para <input type="date"> (yyyy-mm-dd). */
export function isoToDateInput(value?: ISODateString | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
