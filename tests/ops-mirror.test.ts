/**
 * Guardas del espejo LOGS → OPS (services/ops-mirror.ts).
 *
 * Verifica que el vocabulario emitido a logistics_material_requirements.status
 * respeta su CHECK constraint real (consultado en el proyecto compartido el
 * 2026-07-10) y que las listas blancas de columnas no crecen sin querer.
 */
import { describe, expect, it } from "vitest";
import {
  requirementStatusFromRequest,
  materialStatusLabel,
  SERVICE_MIRROR_COLUMNS,
  ISDIN_MIRROR_COLUMNS,
  REQUIREMENT_MIRROR_COLUMNS,
  mirrorRequestStatus,
  mirrorPickingLink,
  mirrorShipmentLink
} from "@/services/ops-mirror";

// CHECK real de logistics_material_requirements.status (pg_constraint, 2026-07-10).
const REQUIREMENT_STATUS_ALLOWED = [
  "pendiente_revision", "aceptada", "pendiente_stock", "pendiente_produccion",
  "pendiente_recepcion", "parcialmente_disponible", "disponible", "reservada",
  "en_picking", "preparada", "enviada", "entregada", "consumida", "cancelada",
  "bloqueada", "con_incidencia"
];

// CHECK real de logistics_requests.status: claves de entrada del mapa.
const REQUEST_STATUS_DB = [
  "borrador", "enviada", "pendiente_revision", "aceptada", "parcialmente_aceptada",
  "rechazada", "pendiente_material", "en_preparacion", "preparada",
  "enviada_transporte", "entregada", "cerrada", "cancelada", "bloqueada"
];

describe("ops-mirror: vocabulario y listas blancas", () => {
  it("cada estado de peticion del DB tiene traduccion a estado de necesidad valido", () => {
    for (const dbStatus of REQUEST_STATUS_DB) {
      const mapped = requirementStatusFromRequest[dbStatus];
      expect(mapped, `falta traduccion para requests.status "${dbStatus}"`).toBeTruthy();
      expect(REQUIREMENT_STATUS_ALLOWED, `"${dbStatus}" → "${mapped}" viola el CHECK de requirements`).toContain(mapped);
    }
  });

  it("el mapa no emite ningun valor fuera del CHECK de requirements", () => {
    for (const value of Object.values(requirementStatusFromRequest)) {
      expect(REQUIREMENT_STATUS_ALLOWED).toContain(value);
    }
  });

  it("todo estado de necesidad emitido tiene etiqueta para services.material_status", () => {
    for (const value of Object.values(requirementStatusFromRequest)) {
      expect(materialStatusLabel[value], `falta etiqueta material_status para "${value}"`).toBeTruthy();
    }
  });

  it("las listas blancas de columnas son exactamente las pactadas", () => {
    expect([...SERVICE_MIRROR_COLUMNS]).toEqual(["logistics_status", "material_status", "logistics_last_sync_at"]);
    expect([...ISDIN_MIRROR_COLUMNS]).toEqual([
      "logistics_status", "logistics_picking_id", "logistics_shipment_id", "logistics_blocked", "logistics_last_sync_at"
    ]);
    expect([...REQUIREMENT_MIRROR_COLUMNS]).toEqual(["status", "picking_id", "shipment_id", "updated_at"]);
  });

  it("sin configuracion Supabase, el espejo es un no-op silencioso (no lanza)", async () => {
    await expect(mirrorRequestStatus("x", "entregada")).resolves.toBeUndefined();
    await expect(mirrorPickingLink("x", "y")).resolves.toBeUndefined();
    await expect(mirrorShipmentLink("x", "y")).resolves.toBeUndefined();
  });
});
