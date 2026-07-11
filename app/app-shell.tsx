"use client";

/**
 * Shell del rediseño MerchanLOGS: sidebar oscura (Primary #0F172A) con el menu
 * aprobado en los mockups y barra superior con buscador global, selector de
 * campana, indicador de conexion y selector de usuario/rol simulado.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  ClipboardList,
  Cog,
  Copy,
  Inbox,
  LayoutDashboard,
  LineChart,
  Megaphone,
  PackageCheck,
  Search,
  Truck,
  TriangleAlert,
  Users,
  Warehouse
} from "lucide-react";
import { SessionProvider, useSession } from "@/components/session-provider";
import { ConnectionBadge } from "@/components/connection-status";
import { Permission, roleLabels } from "@/lib/permissions";
import { getAdapter } from "@/services/adapter";
import { useData } from "@/components/use-data";

interface NavItem {
  href: string;
  label: string;
  permission: Permission;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", permission: "requests.view", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/campanas", label: "Campañas", permission: "campaigns.view", icon: <Megaphone className="h-4 w-4" /> },
  { href: "/peticiones", label: "Peticiones", permission: "requests.view", icon: <Inbox className="h-4 w-4" /> },
  { href: "/materiales", label: "Materiales", permission: "materials.view", icon: <Boxes className="h-4 w-4" /> },
  { href: "/entradas", label: "Entradas", permission: "entries.view", icon: <Warehouse className="h-4 w-4" /> },
  { href: "/picking", label: "Picking", permission: "picking.view", icon: <ClipboardList className="h-4 w-4" /> },
  { href: "/envios", label: "Envíos", permission: "shipments.view", icon: <Truck className="h-4 w-4" /> },
  { href: "/incidencias", label: "Incidencias", permission: "incidents.view", icon: <TriangleAlert className="h-4 w-4" /> },
  { href: "/reproducciones", label: "Reproducciones", permission: "incidents.view", icon: <Copy className="h-4 w-4" /> },
  { href: "/instaladores", label: "Instaladores", permission: "picking.view", icon: <Users className="h-4 w-4" /> },
  { href: "/proveedores", label: "Proveedores", permission: "entries.view", icon: <PackageCheck className="h-4 w-4" /> },
  { href: "/insights", label: "Power BI / Insights", permission: "requests.view", icon: <LineChart className="h-4 w-4" /> }
];

// ---------------------------------------------------------------------------
// Filtro global de campana (topbar) compartido por las pantallas.
// ---------------------------------------------------------------------------

const CampaignFilterContext = createContext<{ campaignId: string; setCampaignId: (id: string) => void }>({
  campaignId: "",
  setCampaignId: () => undefined
});

export const useCampaignFilter = () => useContext(CampaignFilterContext);

function Sidebar() {
  const { can, user } = useSession();
  const pathname = usePathname();
  const visible = navItems.filter((item) => can(item.permission));

  return (
    <aside className="lg-sidebar hidden w-56 shrink-0 flex-col md:flex">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">M</span>
        <div className="leading-tight">
          <p className="text-sm font-extrabold text-white">
            Merchan<span className="text-blue-400">LOGS</span>
          </p>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Logistics Management</p>
        </div>
      </div>
      <nav className="lg-scroll flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-4">
        {visible.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`lg-nav-item ${active ? "lg-nav-active" : ""}`}>
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-2.5 py-3">
        <Link href="/configuracion" className={`lg-nav-item ${pathname.startsWith("/configuracion") ? "lg-nav-active" : ""}`}>
          <Cog className="h-4 w-4" />
          Configuración
        </Link>
        <p className="mt-2 truncate px-3 text-[10px] text-slate-500">{user?.displayName ?? "—"}</p>
      </div>
    </aside>
  );
}

function TopBar() {
  const { user, users, switchUser, refreshData } = useSession();
  const { campaignId, setCampaignId } = useCampaignFilter();
  const { data: campaigns } = useData(() => getAdapter().list("campaigns"), []);
  const { data: requests } = useData(() => getAdapter().list("logisticsRequests"), []);
  const router = useRouter();
  const [q, setQ] = useState("");

  const pendingAlerts = useMemo(
    () => (requests ?? []).filter((r) => ["solicitada", "en_revision", "pendiente_material"].includes(r.status)).length,
    [requests]
  );

  async function handleReset() {
    if (!window.confirm("Reiniciar todos los datos locales a la semilla inicial?")) return;
    await getAdapter().reset();
    refreshData();
    window.location.reload();
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/materiales?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
      <form onSubmit={submitSearch} className="relative min-w-[200px] flex-1 md:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="lg-input pl-9"
          placeholder="Buscar expediciones, materiales o campañas..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      <select className="lg-select w-44" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} title="Filtrar por campaña">
        <option value="">Campaña: Todas</option>
        {(campaigns ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.campaignName}
          </option>
        ))}
      </select>
      <ConnectionBadge />
      <Link href="/peticiones" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Peticiones pendientes">
        <Bell className="h-4 w-4" />
        {pendingAlerts > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
            {pendingAlerts}
          </span>
        )}
      </Link>
      <label className="flex items-center gap-2 text-sm">
        <select value={user?.id ?? ""} onChange={(e) => switchUser(e.target.value)} className="lg-select w-44">
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({roleLabels[u.role]})
            </option>
          ))}
        </select>
      </label>
      <button onClick={handleReset} className="text-[10px] text-slate-300 hover:text-red-600" title="Reiniciar datos locales">
        Reset
      </button>
    </header>
  );
}

/**
 * Aviso bloqueante de modo local (auditoría A9): si el despliegue no tiene
 * NEXT_PUBLIC_DATA_SOURCE=supabase, la app corre sobre datos de demostración
 * en el navegador. Eso jamás debe pasar desapercibido en producción.
 */
function LocalModeBanner() {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase") return null;
  return (
    <div className="sticky top-0 z-30 bg-red-600 px-4 py-1.5 text-center text-xs font-bold text-white">
      ⚠ MODO DEMO LOCAL — esta instancia NO está conectada al backend compartido: los datos son de prueba y viven
      solo en este navegador. Si esto es producción, falta configurar NEXT_PUBLIC_DATA_SOURCE=supabase.
    </div>
  );
}

function Chrome({ children }: { children: React.ReactNode }) {
  const { loading } = useSession();
  const [campaignId, setCampaignId] = useState("");
  return (
    <CampaignFilterContext.Provider value={{ campaignId, setCampaignId }}>
      <LocalModeBanner />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 p-4 md:p-6">
            {loading ? <p className="text-sm text-slate-400">Cargando...</p> : children}
          </main>
        </div>
      </div>
    </CampaignFilterContext.Provider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Chrome>{children}</Chrome>
    </SessionProvider>
  );
}
