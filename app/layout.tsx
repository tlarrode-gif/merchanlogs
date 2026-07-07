import type { Metadata } from "next";
import type React from "react";
import "./globals.css";
import { AppShell } from "@/components/merchanlogs/app-shell";

export const metadata: Metadata = {
  title: "MerchanLOGS",
  description: "Gestión logística sincronizada con MerchanOPS"
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
