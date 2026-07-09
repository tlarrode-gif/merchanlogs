import { beforeEach, describe, expect, it } from "vitest";
import { LogisticsRequest } from "@/types";
import { getAdapter } from "@/services/adapter";
import { availableStock, applyStockDelta } from "@/services/stock.service";
import {
  createPickingFromRequest,
  prepareLine,
  cancelLine,
  closePickingBatch,
  getStockCoverage
} from "@/services/picking.service";
import { readMaterial, seedMaterial } from "./helpers";

beforeEach(async () => {
  await getAdapter().reset();
});

function fakeRequest(materialId: string, quantity: number): LogisticsRequest {
  return {
    id: "req_test",
    requestCode: "PET-2026-9999",
    clientId: "cli_test",
    campaignId: null,
    priority: "normal",
    status: "preparando",
    requestedDate: "2026-07-09",
    materials: [{ materialId, quantity, preparedQuantity: 0 }],
    destination: "PDV de prueba"
  } as LogisticsRequest;
}

describe("createPickingFromRequest", () => {
  it("reserva stock al crear pero NO descuenta el fisico", async () => {
    const m = await seedMaterial({ currentStock: 10 });
    await createPickingFromRequest(fakeRequest(m.id, 4), "por_punto_venta", "usr_test");
    const after = await readMaterial(m.id);
    expect(after.currentStock).toBe(10); // fisico intacto
    expect(after.reservedStock).toBe(4); // reservado
    expect(availableStock(after)).toBe(6);
  });

  it("falla si no hay disponible suficiente para reservar", async () => {
    const m = await seedMaterial({ currentStock: 3 });
    await expect(createPickingFromRequest(fakeRequest(m.id, 5), "por_punto_venta", "usr_test")).rejects.toThrow(
      /insuficiente/i
    );
  });
});

describe("closePickingBatch", () => {
  it("solo descuenta el fisico al cerrar y libera la reserva", async () => {
    const m = await seedMaterial({ currentStock: 10 });
    const batch = await createPickingFromRequest(fakeRequest(m.id, 4), "por_punto_venta", "usr_test");

    // preparar no descuenta fisico
    await prepareLine(batch.id, batch.lines[0].id, 4, "usr_test");
    let mid = await readMaterial(m.id);
    expect(mid.currentStock).toBe(10);
    expect(mid.reservedStock).toBe(4);

    // cerrar descuenta lo preparado y libera la reserva
    const res = await closePickingBatch(batch.id, "usr_test");
    expect(res.consumedUnits).toBe(4);
    expect(res.partial).toBe(false);
    const after = await readMaterial(m.id);
    expect(after.currentStock).toBe(6);
    expect(after.reservedStock).toBe(0);
  });

  it("cierre parcial descuenta solo lo preparado y libera toda la reserva", async () => {
    const m = await seedMaterial({ currentStock: 10 });
    const batch = await createPickingFromRequest(fakeRequest(m.id, 5), "por_punto_venta", "usr_test");
    await prepareLine(batch.id, batch.lines[0].id, 2, "usr_test");

    const res = await closePickingBatch(batch.id, "usr_test");
    expect(res.consumedUnits).toBe(2);
    expect(res.partial).toBe(true);
    const after = await readMaterial(m.id);
    expect(after.currentStock).toBe(8);
    expect(after.reservedStock).toBe(0);
  });

  it("es idempotente: no se puede cerrar dos veces", async () => {
    const m = await seedMaterial({ currentStock: 10 });
    const batch = await createPickingFromRequest(fakeRequest(m.id, 2), "por_punto_venta", "usr_test");
    await prepareLine(batch.id, batch.lines[0].id, 2, "usr_test");
    await closePickingBatch(batch.id, "usr_test");
    await expect(closePickingBatch(batch.id, "usr_test")).rejects.toThrow(/ya esta cerrado/i);
  });

  it("una linea cancelada no consume stock y libera su reserva al cerrar", async () => {
    const m = await seedMaterial({ currentStock: 10 });
    const batch = await createPickingFromRequest(fakeRequest(m.id, 4), "por_punto_venta", "usr_test");
    await cancelLine(batch.id, batch.lines[0].id, "usr_test");

    const res = await closePickingBatch(batch.id, "usr_test");
    expect(res.consumedUnits).toBe(0);
    const after = await readMaterial(m.id);
    expect(after.currentStock).toBe(10);
    expect(after.reservedStock).toBe(0);
  });
});

describe("getStockCoverage", () => {
  it("marca cubierta la linea de un batch recien creado (fisico suficiente)", async () => {
    const m = await seedMaterial({ currentStock: 10 });
    const batch = await createPickingFromRequest(fakeRequest(m.id, 4), "por_punto_venta", "usr_test");
    const coverage = await getStockCoverage(batch);
    // disponible para este batch = availableStock(1) + su_propia_reserva(4) = fisico(10)... limitado por linea
    expect(coverage[0].covered).toBe(true);
  });

  it("no cuenta la reserva propia contra si misma", async () => {
    const m = await seedMaterial({ currentStock: 4 });
    // El batch reserva 4 (todo el disponible). Sin excluir su propia reserva,
    // availableStock seria 0 y la cobertura daria falso negativo.
    const batch = await createPickingFromRequest(fakeRequest(m.id, 4), "por_punto_venta", "usr_test");
    const coverage = await getStockCoverage(batch);
    expect(coverage[0].available).toBe(4);
    expect(coverage[0].covered).toBe(true);
  });

  it("se vuelve no cubierta si el fisico baja por debajo de lo pedido", async () => {
    const m = await seedMaterial({ currentStock: 10 });
    const batch = await createPickingFromRequest(fakeRequest(m.id, 3), "por_punto_venta", "usr_test");
    // Un ajuste posterior reduce el fisico por debajo de lo que pide la linea.
    await applyStockDelta({ materialId: m.id, delta: -8, type: "ajuste" });
    const coverage = await getStockCoverage(batch);
    // disponible para el batch = fisico real restante (2), y la linea pide 3
    expect(coverage[0].available).toBe(2);
    expect(coverage[0].covered).toBe(false);
  });
});
