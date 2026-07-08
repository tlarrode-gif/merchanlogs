/** Generadores de identificadores y codigos legibles. */

/** Identificador unico con prefijo (ej. "req_ab12..."). */
export function uid(prefix = "id"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

/**
 * Genera un codigo secuencial legible tipo "PET-2026-0007" a partir de los
 * codigos ya existentes. No pretende ser robusto frente a concurrencia (eso lo
 * resolvera Supabase con secuencias); es suficiente para la fase local.
 */
export function nextCode(prefix: string, existing: string[], year = new Date().getFullYear()): string {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max = existing.reduce((acc, code) => {
    const match = re.exec(code || "");
    if (!match) return acc;
    return Math.max(acc, Number(match[1]));
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}
