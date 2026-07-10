/**
 * Guardas del SupabaseAdapter (fase 3b, lectura + escritura logistics_*).
 * No requiere red: verifica el comportamiento sin configuracion, los bloqueos
 * de co-propiedad y que los mapas inversos SOLO emiten valores admitidos por
 * los CHECK constraints reales del DB compartido (consultados el 2026-07-10).
 */
import { describe, expect, it } from "vitest";
import {
  supabaseAdapter,
  requestStatusToDb,
  priorityToDb,
  entryStatusToDb,
  movementTypeToDb,
  pickingStatusToDb,
  pickingLineStatusToDb,
  shipmentStatusToDb,
  incidentStatusToDb,
  incidentSeverityToDb,
  incidentTypeToDb,
  materialTypeToDb,
  unitToDb
} from "@/services/supabase-adapter";

describe("SupabaseAdapter (guardas fase 3b)", () => {
  it("bloquea SIEMPRE la escritura en maestros de OPS", async () => {
    await expect(supabaseAdapter.insert("clients", {} as never)).rejects.toThrow(/propiedad de MerchanOPS/i);
    await expect(supabaseAdapter.update("services", "x", {})).rejects.toThrow(/propiedad de MerchanOPS/i);
    await expect(supabaseAdapter.remove("users", "x")).rejects.toThrow(/propiedad de MerchanOPS/i);
    await expect(supabaseAdapter.update("campaigns", "x", {})).rejects.toThrow(/propiedad de MerchanOPS/i);
  });

  it("sin configuracion, la escritura logistica falla con mensaje explicativo (no en silencio)", async () => {
    await expect(supabaseAdapter.insert("materials", {} as never)).rejects.toThrow(/no esta configurado/i);
    await expect(supabaseAdapter.update("pickingBatches", "x", { status: "cerrado" })).rejects.toThrow(
      /no esta configurado/i
    );
  });

  it("los movimientos de stock son inmutables (trazabilidad)", async () => {
    await expect(supabaseAdapter.update("stockMovements", "x", {})).rejects.toThrow(/inmutables/i);
    await expect(supabaseAdapter.remove("stockMovements", "x")).rejects.toThrow(/inmutables/i);
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

// ---------------------------------------------------------------------------
// Vocabulario admitido por los CHECK constraints del DB compartido.
// Copiado literalmente de pg_constraint del proyecto MerchanOPS (2026-07-10).
// Si OPS cambia un CHECK, este test detectara la divergencia al actualizarlo.
// ---------------------------------------------------------------------------

const DB_ALLOWED = {
  requestStatus: [
    "borrador", "enviada", "pendiente_revision", "aceptada", "parcialmente_aceptada",
    "rechazada", "pendiente_material", "en_preparacion", "preparada",
    "enviada_transporte", "entregada", "cerrada", "cancelada", "bloqueada"
  ],
  priority: ["critica", "alta", "media", "baja"],
  entryStatus: ["pendiente", "recibido_parcial", "recibido_completo", "con_incidencia", "rechazado", "cerrado"],
  movementType: [
    "entrada", "salida", "reserva", "liberacion", "picking", "entrega",
    "consumo", "devolucion", "danio", "perdida", "ajuste", "transferencia"
  ],
  pickingStatus: ["pendiente", "en_preparacion", "preparado", "revisado", "enviado", "recibido", "cerrado"],
  pickingLineStatus: ["pendiente", "listo", "faltante"],
  shipmentStatus: ["pendiente", "preparado", "recogido", "en_transito", "entregado", "fallido", "extraviado", "devuelto"],
  incidentStatus: [
    "nueva", "en_revision", "pend_proveedor", "pend_produccion", "pend_transporte",
    "mat_enviado", "resuelta", "cancelada"
  ],
  incidentType: [
    "sin_picking", "medidas", "danado", "incorrecto", "falta", "exceso", "perdida",
    "entrega_fallida", "defecto_produccion", "material_no_recibido", "medidas_incorrectas",
    "material_danado", "vin_equivocado", "instalacion_no_realizada", "farmacia_cerrada",
    "escaparate_cambiado", "material_sobrante"
  ],
  materialType: ["vinilo_estandar", "vinilo_medida", "herramienta", "consumible"],
  unit: ["uds", "rollos", "m2", "cajas"]
} as const;

function expectAllValuesAllowed(map: Record<string, string>, allowed: readonly string[], label: string) {
  for (const [domainValue, dbValue] of Object.entries(map)) {
    expect(allowed, `${label}: "${domainValue}" → "${dbValue}" no esta admitido por el CHECK del DB`).toContain(
      dbValue
    );
  }
}

describe("Mapas inversos dominio → DB: solo emiten valores admitidos por los CHECK", () => {
  it("estados de peticion", () => expectAllValuesAllowed(requestStatusToDb, DB_ALLOWED.requestStatus, "requests.status"));
  it("prioridades", () => expectAllValuesAllowed(priorityToDb, DB_ALLOWED.priority, "requests.priority"));
  it("estados de entrada", () => expectAllValuesAllowed(entryStatusToDb, DB_ALLOWED.entryStatus, "entries.estado"));
  it("tipos de movimiento", () => expectAllValuesAllowed(movementTypeToDb, DB_ALLOWED.movementType, "movements.tipo"));
  it("estados de picking", () => expectAllValuesAllowed(pickingStatusToDb, DB_ALLOWED.pickingStatus, "pickings.estado"));
  it("estados de linea de picking", () =>
    expectAllValuesAllowed(pickingLineStatusToDb, DB_ALLOWED.pickingLineStatus, "picking_lines.estado"));
  it("estados de envio", () => expectAllValuesAllowed(shipmentStatusToDb, DB_ALLOWED.shipmentStatus, "shipments.estado"));
  it("estados de incidencia", () =>
    expectAllValuesAllowed(incidentStatusToDb, DB_ALLOWED.incidentStatus, "incidents.estado"));
  it("tipos de incidencia", () => expectAllValuesAllowed(incidentTypeToDb, DB_ALLOWED.incidentType, "incidents.tipo"));

  it("severidad de incidencia usa el vocabulario de impacto del DB", () => {
    for (const v of Object.values(incidentSeverityToDb)) {
      expect(["bajo", "medio", "alto", "critico"]).toContain(v);
    }
  });

  it("tipo y unidad de material respetan los CHECK de logistics_materials", () => {
    const domainTypes = ["vinilo", "plv", "display", "carteleria", "muestra", "promocional", "generico", "otro"] as const;
    for (const t of domainTypes) {
      expect(DB_ALLOWED.materialType).toContain(materialTypeToDb(t));
    }
    for (const u of ["ud", "uds", "unidades", "rollos", "m2", "cajas", "", undefined, "lo-que-sea"]) {
      expect(DB_ALLOWED.unit).toContain(unitToDb(u as string | undefined));
    }
  });
});
