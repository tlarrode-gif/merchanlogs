/**
 * Sesion de usuario.
 *
 * Con NEXT_PUBLIC_DATA_SOURCE=supabase la sesion es REAL (C1): login contra
 * Supabase Auth con los mismos usuarios/contraseñas de MerchanOPS (app_users),
 * via rpc merchan_auth_bootstrap + signInWithPassword. El usuario activo sale
 * del JWT (rpc merchan_auth_whoami), no de localStorage, y no se puede cambiar
 * sin volver a iniciar sesion.
 *
 * En modo local/demo se mantiene la sesion simulada de siempre (selector de
 * usuario en la barra superior) para poder probar permisos sin backend.
 */

import { User } from "@/types";
import { getAdapter } from "@/services/adapter";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const SESSION_KEY = "merchanlogs_session_user_v1";
export const sessionChangeEvent = "merchanlogs-session-change";

export function isRealAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" && isSupabaseConfigured && Boolean(supabase);
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function notifySessionChange(): void {
  if (isBrowser()) window.dispatchEvent(new CustomEvent(sessionChangeEvent));
}

export async function listUsers(): Promise<User[]> {
  return getAdapter().list("users");
}

export async function getCurrentUser(): Promise<User | null> {
  if (isRealAuthMode()) {
    const { data } = await supabase!.auth.getSession();
    if (!data.session) return null;
    const { data: profile, error } = await supabase!.rpc("merchan_auth_whoami");
    if (error || !profile) return null;
    const appUserId = String((profile as Record<string, unknown>).id ?? "");
    const users = await listUsers();
    return users.find((u) => u.id === appUserId) ?? null;
  }

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
  const leastPrivileged =
    users.find((u) => u.role === "almacen" && u.active) ??
    users.find((u) => u.role === "gestor" && u.active) ??
    users.find((u) => u.active) ??
    users[0];
  return leastPrivileged;
}

/** Login real contra Supabase Auth (solo en modo supabase). */
export async function loginWithPassword(username: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isRealAuthMode()) return { ok: false, error: "Esta instancia funciona en modo demo local: no requiere login." };
  const { data, error } = await supabase!.rpc("merchan_auth_bootstrap", { p_username: username, p_password: password });
  if (error) return { ok: false, error: `No se ha podido iniciar sesión: ${error.message}` };
  const result = (data ?? {}) as { email?: string; error?: string };
  if (result.error || !result.email) return { ok: false, error: result.error || "Usuario o contraseña incorrectos" };
  const { error: authError } = await supabase!.auth.signInWithPassword({ email: result.email, password });
  if (authError) return { ok: false, error: `No se ha podido iniciar sesión: ${authError.message}` };
  notifySessionChange();
  return { ok: true };
}

export async function logout(): Promise<void> {
  if (isRealAuthMode()) await supabase!.auth.signOut().catch(() => undefined);
  if (isBrowser()) window.localStorage.removeItem(SESSION_KEY);
  notifySessionChange();
}

/** Cambio de usuario simulado: solo tiene efecto en modo local/demo. */
export function setCurrentUser(userId: string): void {
  if (isRealAuthMode()) return;
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_KEY, userId);
  notifySessionChange();
}
