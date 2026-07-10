"use client";

/** Pestañas del area de Campañas: integra Clientes/CECOs y Servicios. */

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/campanas", label: "Campañas" },
  { href: "/clientes", label: "Clientes / CECOs" },
  { href: "/servicios", label: "Servicios" }
];

export function CampaignTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
