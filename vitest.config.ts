import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Configuracion de Vitest para la capa de servicios/dominio.
 *
 * Los tests corren en Node (sin window), por lo que el `LocalAdapter` opera en
 * memoria a partir de la semilla y `reset()` deja un estado limpio entre casos.
 * El alias `@/*` replica el de tsconfig para poder importar como en la app.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
