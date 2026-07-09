import { beforeEach, describe, expect, it } from "vitest";
import { getAdapter } from "@/services/adapter";
import {
  applyStockDelta,
  availableStock,
  reserveStock,
  releaseReservation
} from "@/services/stock.service";
import { readMaterial, seedMaterial } from "./helpers";

beforeEach(async () => {
  await getAdapter().reset();
});

describe("availableStock", () => {
  it("es fisico menos reservado", () => {
    expect(availableStock({ currentStock: 10, reservedStock: 3 } as never)).toBe(7);
  });

  it("trata reservedStock ausente como 0", () => {
    expect(availableStock({ currentStock: 5 } as never)).toBe(5);
  });
});

describe("reserveStock", () => {
  it("incrementa reservedStock sin tocar el stock fisico", async () => {
    const m = await seedMaterial({ currentStock: 10, reservedStock: 0 });
    await reserveStock(m.id, 4, "pck_1", "usr_test");
    const after = await readMaterial(m.id);
    expect(after.currentStock).toBe(10);
    expect(after.reservedStock).toBe(4);
    expect(availableStock(after)).toBe(6);
  });

  it("bloquea si la reserva supera el disponible (regla de stock)", async () => {
    const m = await seedMaterial({ currentStock: 10, reservedStock: 8 });
    await expect(reserveStock(m.id, 5, "pck_1", "usr_test")).rejects.toThrow(/insuficiente/i);
    const after = await readMaterial(m.id);
    // no debe haber mutado nada
    expect(after.reservedStock).toBe(8);
    expect(availableStock(after)).toBe(2);
  });

  it("permite reservar exactamente el disponible", async () => {
    const m = await seedMaterial({ currentStock: 10, reservedStock: 8 });
    await reserveStock(m.id, 2, "pck_1", "usr_test");
    const after = await readMaterial(m.id);
    expect(after.reservedStock).toBe(10);
    expect(availableStock(after)).toBe(0);
  });
});

describe("releaseReservation", () => {
  it("reduce reservedStock sin bajar de 0", async () => {
    const m = await seedMaterial({ currentStock: 10, reservedStock: 3 });
    await releaseReservation(m.id, 5, "pck_1", "usr_test");
    const after = await readMaterial(m.id);
    expect(after.reservedStock).toBe(0);
    expect(after.currentStock).toBe(10);
  });
});

describe("applyStockDelta", () => {
  it("descuenta stock fisico y genera un movimiento", async () => {
    const m = await seedMaterial({ currentStock: 10 });
    const { material, movement } = await applyStockDelta({
      materialId: m.id,
      delta: -3,
      type: "salida_picking"
    });
    expect(material.currentStock).toBe(7);
    expect(movement.quantity).toBe(3);
    expect(movement.type).toBe("salida_picking");
  });

  it("no permite dejar el stock fisico negativo", async () => {
    const m = await seedMaterial({ currentStock: 2 });
    await expect(applyStockDelta({ materialId: m.id, delta: -5, type: "salida_picking" })).rejects.toThrow(
      /insuficiente/i
    );
    expect((await readMaterial(m.id)).currentStock).toBe(2);
  });

  it("marca el material como agotado al llegar a 0", async () => {
    const m = await seedMaterial({ currentStock: 3, minimumStock: 1 });
    const { material } = await applyStockDelta({ materialId: m.id, delta: -3, type: "salida_picking" });
    expect(material.currentStock).toBe(0);
    expect(material.status).toBe("agotado");
  });
});
