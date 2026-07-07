"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Settings,
  Ship,
  Truck,
  Warehouse
} from "lucide-react";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/ubicaciones", label: "Ubicaciones", icon: Warehouse },
  { href: "/movimientos", label: "Movimientos", icon: Archive },
  { href: "/solicitudes", label: "Solicitudes", icon: ClipboardList },
  { href: "/picking", label: "Picking", icon: PackageCheck },
  { href: "/envios", label: "Envíos", icon: Truck },
  { href: "/recogidas", label: "Recogidas", icon: Ship },
  { href: "/incidencias", label: "Incidencias", icon: AlertTriangle },
  { href: "/sincronizacion", label: "Sincronización", icon: RefreshCw },
  { href: "/administracion", label: "Administración", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-white">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brass">Merchan</p>
              <h1 className="text-2xl font-black tracking-tight">MerchanLOGS</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-5 text-slate-500">Control logístico conectado con MerchanOPS.</p>
        </div>

        <nav className="soft-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map(item => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                  active ? "bg-ink text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
            Sincronización preparada para MerchanOPS y futura lectura desde MerchanVIEW.
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-white">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brass">Merchan</p>
              <h1 className="text-xl font-black">MerchanLOGS</h1>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navigation.map(item => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <a key={item.href} href={item.href} className={active ? "whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white" : "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold text-slate-600"}>
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
        <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
