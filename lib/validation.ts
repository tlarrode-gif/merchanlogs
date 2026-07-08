/** Validaciones ligeras reutilizables por servicios y formularios. */

export type ValidationResult = { valid: boolean; errors: string[] };

export function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

export function fail(...errors: string[]): ValidationResult {
  return { valid: false, errors: errors.filter(Boolean) };
}

export function combine(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return { valid: errors.length === 0, errors };
}

export function required(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return `${field} es obligatorio`;
  if (typeof value === "string" && value.trim() === "") return `${field} es obligatorio`;
  if (Array.isArray(value) && value.length === 0) return `${field} es obligatorio`;
  return null;
}

export function positive(value: number, field: string): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) return `${field} debe ser un numero`;
  if (value <= 0) return `${field} debe ser mayor que 0`;
  return null;
}

export function nonNegative(value: number, field: string): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) return `${field} debe ser un numero`;
  if (value < 0) return `${field} no puede ser negativo`;
  return null;
}

/** Construye un ValidationResult a partir de una lista de posibles errores. */
export function validate(...maybeErrors: (string | null)[]): ValidationResult {
  const errors = maybeErrors.filter((e): e is string => Boolean(e));
  return { valid: errors.length === 0, errors };
}
