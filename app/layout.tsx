import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/app/app-shell";

export const metadata: Metadata = {
  title: "MerchanLOGS",
  description: "Plataforma logistica interna de Merchanservis.",
  // App instalable (picking móvil): añadir a pantalla de inicio desde el navegador.
  manifest: "/manifest.json",
  icons: { icon: "/icon-logs.svg", apple: "/icon-logs.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Picking" }
};

export const viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
