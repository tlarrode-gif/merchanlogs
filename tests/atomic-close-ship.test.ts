/**
 * A8 — equivalencia del modo atomico: cuando los comandos del DB estan
 * disponibles, cerrar picking / generar envio / confirmar entrega delegan TODO
 * el efecto de stock y de estado critico en los RPC transaccionales
 * (logistics_close_picking / ship / confirm_delivery) y el cliente NO muta
 * stock localmente — si lo hiciera, habria DOBLE descuento (una vez el RPC en
 * el DB y otra el navegador).
 *
 * El modo local (sin Supabase) conserva el flujo anterior y lo cubren
 * tests/picking.test.ts y tests/stock.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PickingBatch, Shipment } from "@/types";
import { defaultSyncFields } from "@/types";
import { getAdapter } from "@/services/adapter";
import { nowIso } from "@/lib/dates";
import { readMaterial, seedMaterial } from "./helpers";

const closePickingAtomic = vi.fn(async () => undefined);
const shipPickingAtomic = vi.fn(async () => ({ shipmentId: "shp_atomic" }));
const confirmDeliveryAtomic = vi.fn(async () => undefined);

vi.mock("@/services/atomic-commands", () => ({
  atomicCommandsAvailable: () => true,
  closePickingAtomic: (...args: unknown[]) => closePickingAtomic(...(args as [])),
  shipPickingAtomic: (...args: unknown[]) => shipPickingAtomic(...(args as [])),
  confirmDeliveryAtomic: (...args: unknown[]) => confirmDeliveryAtomic(...(args as [])),
  reserveStockAtomic: vi.fn(async () => undefined),
  releaseReservationAtomic: vi.fn(async () => undefined),
  rejectRequestAtomic: vi.fn(async () => undefined)
}));

async function seedBatch(materialId: string): Promise<PickingBatch> {
  const now = nowIso();
  const batch = {
    id: "pck_atomic_test",
    pickingCode: "PCK-TEST-A8",
    clientId: "cli_test",
    campaignId: null,
    logisticsRequestId: null,
    groupingType: "por_punto_venta",
    status: "preparado_completo",
    priority: "normal",
    assignedTo: null,
    assignedInstaller: null,
    province: null,
    closedAt: null,
    notes: null,
    lines: [
      {
        id: "lin_1",
        materialId,
        materialItemId: null,
        description: "Linea agregada",
        quantity: 5,
        preparedQuantity: 4,
        status: "preparado",
        pointOfSaleName: null,
        officeName: null,
        officeCode: null
      }
    ],
    ...defaultSyncFields(now, "usr_test")
  } as unknown as PickingBatch;
  return getAdapter().insert("pickingBatches", batch);
}

beforeEach(async () => {
  await getAdapter().reset();
  closePickingAtomic.mockClear();
  shipPickingAtomic.mockClear();
  confirmDeliveryAtomic.mockClear();
});

describe("A8: comandos atomicos sin doble descuento", () => {
  it("closePickingBatch delega en el RPC y NO muta stock en el cliente", async () => {
    const material = await seedMaterial({ currentStock: 10, reservedStock: 5 });
    const batch = await seedBatch(material.id);

    const { closePickingBatch } = await import("@/services/picking.service");
    const result = await closePickingBatch(batch.id, "usr_test");

    expect(closePickingAtomic).toHaveBeenCalledTimes(1);
    expect(closePickingAtomic).toHaveBeenCalledWith(batch.id, "usr_test");
    // El stock local NO cambia: el descuento y la liberacion viven en el RPC.
    const after = await readMaterial(material.id);
    expect(after.currentStock).toBe(10);
    expect(after.reservedStock).toBe(5);
    // Estado de dominio y contadores coherentes con el flujo local.
    expect(result.batch.status).toBe("listo_para_envio");
    expect(result.consumedUnits).toBe(4);
    expect(result.partial).toBe(true);
  });

  it("createShipmentFromPicking usa el RPC (no crea un envio paralelo) y completa sus campos", async () => {
    const material = await seedMaterial({ currentStock: 10, reservedStock: 0 });
    const batch = await seedBatch(material.id);
    // El RPC crea la fila del envio en el DB; en el test la sembramos con el
    // id que devuelve el mock para poder completar campos.
    await getAdapter().insert("shipments", {
      id: "shp_atomic",
      shipmentCode: "ENV-A8",
      logisticsRequestId: null,
      clientId: "cli_test",
      campaignId: null,
      carrier: null,
      trackingNumber: null,
      shippingDate: null,
      estimatedDeliveryDate: null,
      deliveryDate: null,
      status: "pendiente",
      destination: null,
      notes: null,
      ...defaultSyncFields(nowIso(), "usr_test")
    } as unknown as Shipment);

    const countBefore = (await getAdapter().list("shipments")).length;
    const { createShipmentFromPicking } = await import("@/services/shipments.service");
    const shipment = await createShipmentFromPicking(batch, { carrier: "SEUR", trackingNumber: "TRK-1" }, "usr_test");

    expect(shipPickingAtomic).toHaveBeenCalledTimes(1);
    expect(shipPickingAtomic).toHaveBeenCalledWith(batch.id, "SEUR", "usr_test");
    expect(shipment.id).toBe("shp_atomic");
    expect(shipment.trackingNumber).toBe("TRK-1");
    // Sin envios paralelos: el cliente no crea otro envio ademas del del RPC.
    expect((await getAdapter().list("shipments")).length).toBe(countBefore);
  });

  it("confirmDelivery delega en el RPC (entrega exactamente una vez)", async () => {
    const shipment = (await getAdapter().insert("shipments", {
      id: "shp_deliver",
      shipmentCode: "ENV-A8-2",
      logisticsRequestId: null,
      clientId: "cli_test",
      campaignId: null,
      carrier: null,
      trackingNumber: null,
      shippingDate: null,
      estimatedDeliveryDate: null,
      deliveryDate: null,
      status: "en_transito",
      destination: null,
      notes: null,
      ...defaultSyncFields(nowIso(), "usr_test")
    } as unknown as Shipment)) as Shipment;

    const { confirmDelivery } = await import("@/services/shipments.service");
    await confirmDelivery(shipment, "usr_test");

    expect(confirmDeliveryAtomic).toHaveBeenCalledTimes(1);
    expect(confirmDeliveryAtomic).toHaveBeenCalledWith(shipment.id, "usr_test");
  });
});
