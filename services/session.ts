/**
 * Sesion simulada (usuario y rol activos).
 *
 * NO hay autenticacion real en esta fase. El usuario activo se guarda en
 * localStorage y se puede cambiar desde la barra superior para probar permisos.
 * Cuando se integre Supabase Auth con MerchanOPS, este modulo se sustituira por
 * la sesion real; el resto de la app seguira usando `getCurrentUser()`.
 */

import { User } from "@/types";
import { getAdapter } from "@/services/adapter";

const SESSION_KEY = "merchanlogs_session_user_v1";
export const sessionChangeEvent = "merchanlogs-session-change";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export async function listUsers(): Promise<User[]> {
  return getAdapter().list("users");
}

export async function getCurrentUser(): Promise<User | null> {
  const users = await listUsers();
  if (users.length === 0) return null;

  if (isBrowser()) {
    const storedId = window.localStorage.getItem(SESSION_KEY);
    const found = storedId ? users.find((u) => u.id === storedId) : null;
    if (found) return found;
  }

  // Endurecimiento C1 (auditoría): la sesion simulada arranca con el MENOR
  // privilegio disponible (almacen -> gestor -> lo que haya), nunca como
  // Administracion por defecto. El rol admin debe elegirse explicitamente.
  // NOTA: esto NO es autenticacion real; la autorizacion efectiva llegara
  // con Supabase Auth + RLS (v9_0 preparada). Documentado en SECURITY_AUDIT.
  const leastPrivileged =
    users.find((u) => u.role === "almacen" && u.active) ??
    users.find((u) => u.role === "gestor" && u.active) ??
    users.find((u) => u.active) ??
    users[0];
  return leastPrivileged;
}

export function setCurrentUser(userId: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_KEY, userId);
  window.dispatchEvent(new CustomEvent(sessionChangeEvent));
}
