/**
 * Sanitizacion de entradas de usuario.
 *
 * React ya escapa lo que se renderiza por JSX (XSS cubierto en render) y el
 * futuro SupabaseAdapter parametriza las consultas, asi que el objetivo es:
 * eliminar caracteres de control invisibles, acotar longitudes y limpiar de
 * forma centralizada todo lo que entra por la capa CRUD (services/crud.ts).
 */

const MAX_TEXT_LENGTH = 10_000;

/** Limpia texto de usuario: sin caracteres de control (salvo \n y \t), recortado y acotado. */
export function sanitizeText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  // eslint-disable-next-line no-control-regex
  let text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
  if (text.length > maxLength) text = text.slice(0, maxLength);
  return text.trim();
}

/**
 * Sanitiza recursivamente todos los strings de un objeto/array (en profundidad).
 * Se aplica en la capa CRUD para que ninguna pantalla pueda colar caracteres de
 * control o textos desmesurados en el almacen, venga de un formulario o de un
 * import copiar/pegar.
 */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") return sanitizeText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitizeDeep(v);
    return out as unknown as T;
  }
  return value;
}
