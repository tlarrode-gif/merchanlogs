import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/app/app-shell";

export const metadata: Metadata = {
  title: "MerchanLOGS",
  description: "Plataforma logistica interna de Merchanservis (MVP fase 1, datos locales)."
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
