"use client";

/**
 * Contexto de sesion (cliente). Expone el usuario/rol activo y utilidades de
 * permisos a toda la app. Al integrar Supabase Auth solo cambia el origen del
 * usuario en services/session.ts; este provider y `usePermission` no cambian.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User } from "@/types";
import { getCurrentUser, listUsers, setCurrentUser, sessionChangeEvent } from "@/services/session";
import { Permission, can } from "@/lib/permissions";

interface SessionContextValue {
  user: User | null;
  users: User[];
  loading: boolean;
  switchUser: (userId: string) => void;
  can: (permission: Permission) => boolean;
  /** Contador que cambia cuando los datos deberian recargarse. */
  dataVersion: number;
  refreshData: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);

  const load = useCallback(async () => {
    // C1: antes del login (o con RLS activa y sin sesión) las consultas pueden
    // fallar; eso no debe dejar la app colgada en "Cargando...": se resuelve a
    // "sin usuario" y el shell muestra el login.
    try {
      const current = await getCurrentUser();
      const all = current ? await listUsers() : [];
      setUser(current);
      setUsers(all);
    } catch {
      setUser(null);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener(sessionChangeEvent, handler);
    return () => window.removeEventListener(sessionChangeEvent, handler);
  }, [load]);

  const switchUser = useCallback((userId: string) => {
    setCurrentUser(userId);
  }, []);

  const refreshData = useCallback(() => setDataVersion((v) => v + 1), []);

  const value: SessionContextValue = {
    user,
    users,
    loading,
    switchUser,
    can: (permission) => can(user?.role, permission),
    dataVersion,
    refreshData
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider");
  return ctx;
}
