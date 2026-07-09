/**
 * Guardas del SupabaseAdapter (fase 3a, solo lectura). No requiere red:
 * verifica el comportamiento sin configuracion y los bloqueos de escritura.
 */
import { describe, expect, it } from "vitest";
import { supabaseAdapter } from "@/services/supabase-adapter";

describe("SupabaseAdapter (guardas fase 3a)", () => {
  it("bloquea insert/update/remove en colecciones Supabase", async () => {
    await expect(supabaseAdapter.insert("materials", {} as never)).rejects.toThrow(/SOLO LECTURA/i);
    await expect(supabaseAdapter.update("pickingBatches", "x", {})).rejects.toThrow(/SOLO LECTURA/i);
    await expect(supabaseAdapter.remove("logisticsRequests", "x")).rejects.toThrow(/solo lectura/i);
  });

  it("reset esta bloqueado SIEMPRE (base compartida)", async () => {
    await expect(supabaseAdapter.reset()).rejects.toThrow(/bloqueado/i);
  });

  it("sin configuracion, la lectura falla con mensaje explicativo", async () => {
    await expect(supabaseAdapter.list("materials")).rejects.toThrow(/no esta configurado/i);
  });

  it("las colecciones sin tabla (requestHistory, importBatches) siguen en local", async () => {
    const history = await supabaseAdapter.list("requestHistory");
    expect(Array.isArray(history)).toBe(true);
  });
});
