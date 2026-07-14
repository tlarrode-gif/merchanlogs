import { beforeEach, describe, expect, it } from "vitest";
import { getAdapter } from "@/services/adapter";
import {
  parsePaste,
  validateRows,
  confirmImport,
  vinylIsCustom,
  standardVinyl
} from "@/services/imports.service";
import { listMaterialItems, confirmMaterialItemEntry } from "@/services/material-items.service";

beforeEach(async () => {
  await getAdapter().reset();
});

describe("vinylIsCustom", () => {
  it("standard cuando la columna lo indica (con y sin acento)", () => {
    expect(vinylIsCustom({ recordType: "Standard" })).toBe(false);
    expect(vinylIsCustom({ recordType: "estándar" })).toBe(false);
    expect(vinylIsCustom({ tipo: "ESTANDAR" })).toBe(false);
  });
  it("a medida por defecto o cuando lo indica", () => {
    expect(vinylIsCustom({})).toBe(true);
    expect(vinylIsCustom({ recordType: "A medida" })).toBe(true);
    expect(vinylIsCustom({ recordType: "Vinilo a medida" })).toBe(true);
  });
});

describe("standardVinyl", () => {
  it("nombra por campaña y medidas: STANDARD - MINIONS 120X150", () => {
    const s = standardVinyl({ campaignName: "Minions", width: "120", height: "150" });
    expect(s.name).toBe("STANDARD - MINIONS 120X150");
    expect(s.code).toBe("STD-MINIONS-120X150");
  });
});

const HEADER = "vinCode\tclientName\tcampaignName\theight\twidth\tquantity\trecordType";

describe("importación ISDIN a medida vs standard", () => {
  it("standard se agrupa como stock; a medida queda pendiente de recepción", async () => {
    const CLIENT = "cli_test_isdin";
    const paste = [
      HEADER,
      "VIN-TEST9001\tISDIN\tMinions\t150\t120\t1\ta medida",
      "\tISDIN\tMinions\t150\t120\t5\tstandard"
    ].join("\n");
    const rows = await validateRows("isdin_vinilos", parsePaste(paste, "isdin_vinilos"));
    expect(rows.every((r) => r.valid)).toBe(true);

    await confirmImport("isdin_vinilos", CLIENT, null, rows, "usr_test");

    // A medida: una pieza única, pendiente de recepción, sin stock ni movimiento aún.
    const items = await listMaterialItems();
    const custom = items.find((i) => i.itemCode === "VIN-TEST9001");
    expect(custom).toBeTruthy();
    expect(custom!.status).toBe("pendiente_recepcion");

    const linkedToItem = (m: { relatedEntityType?: string | null; relatedEntityId?: string | null }) =>
      m.relatedEntityType === "material_item" && m.relatedEntityId === custom!.id;
    const movsAntes = (await getAdapter().list("stockMovements")).filter(linkedToItem);
    expect(movsAntes).toHaveLength(0);

    // Standard: material agregado por campaña+medidas con stock = cantidad.
    const materials = await getAdapter().list("materials");
    const std = materials.find((m) => m.materialCode === "STD-MINIONS-120X150" && m.clientId === CLIENT);
    expect(std).toBeTruthy();
    expect(std!.name).toBe("STANDARD - MINIONS 120X150");
    expect(std!.currentStock).toBe(5);

    // Confirmar la entrada de la pieza a medida: pasa a recibido y registra movimiento.
    const confirmed = await confirmMaterialItemEntry(custom!, "usr_test");
    expect(confirmed.status).toBe("recibido");
    const movsDespues = (await getAdapter().list("stockMovements")).filter(linkedToItem);
    expect(movsDespues).toHaveLength(1);
    expect(movsDespues[0].type).toBe("entrada");
  });
});
