"use client";

/**
 * Shell principal: barra lateral de navegacion (filtrada por permisos) y barra
 * superior con el selector de usuario/rol simulado y el reinicio de datos.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionProvider, useSession } from "@/components/session-provider";
import { Permission } from "@/lib/permissions";
import { roleLabels } from "@/lib/permissions";
import { getAdapter } from "@/services/adapter";

interface NavItem {
  href: string;
  label: string;
  permission: Permission;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", permission: "requests.view" },
  { href: "/clientes", label: "Clientes / CECOs", permission: "clients.view" },
  { href: "/campanas", label: "Campanas", permission: "campaigns.view" },
  { href: "/servicios", label: "Servicios", permission: "services.view" },
  { href: "/materiales", label: "Materiales", permission: "materials.view" },
  { href: "/piezas", label: "Piezas (VIN)", permission: "materials.view" },
  { href: "/importaciones", label: "Carga masiva", permission: "imports.view" },
  { href: "/entradas", label: "Entradas", permission: "entries.view" },
  { href: "/movimientos", label: "Movimientos", permission: "movements.view" },
  { href: "/peticiones", label: "Peticiones", permission: "requests.view" },
  { href: "/solicitudes-ops", label: "Solicitudes OPS", permission: "ops.simulate" },
  { href: "/picking", label: "Picking agrupado", permission: "picking.view" },
  { href: "/envios", label: "Envios", permission: "shipments.view" },
  { href: "/incidencias", label: "Incidencias", permission: "incidents.view" }
];

function Sidebar() {
  const { can } = useSession();
  const pathname = usePathname();
  const visible = navItems.filter((item) => can(item.permission));

  return (
    <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white md:block">
      <div className="border-b border-gray-200 px-4 py-4">
        <span className="text-lg font-bold text-blue-700">MerchanLOGS</span>
        <p className="text-xs text-gray-400">Logistica interna · MVP</p>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {visible.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm ${
                active ? "bg-blue-50 font-medium text-blue-700" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function TopBar() {
  const { user, users, switchUser, refreshData } = useSession();

  async function handleReset() {
    if (!window.confirm("Reiniciar todos los datos locales a la semilla inicial?")) return;
    await getAdapter().reset();
    refreshData();
    window.location.reload();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <div className="text-sm text-gray-500">
        Entorno: <span className="font-medium text-amber-600">Datos locales (sin Supabase)</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Usuario:</span>
          <select
            value={user?.id ?? ""}
            onChange={(e) => switchUser(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({roleLabels[u.role]})
              </option>
            ))}
          </select>
        </label>
        <button onClick={handleReset} className="text-xs text-gray-400 hover:text-red-600" title="Reiniciar datos locales">
          Reiniciar datos
        </button>
      </div>
    </header>
  );
}

function Chrome({ children }: { children: React.ReactNode }) {
  const { loading } = useSession();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 p-4 md:p-6">
          {loading ? <p className="text-sm text-gray-400">Cargando...</p> : children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Chrome>{children}</Chrome>
    </SessionProvider>
  );
}
