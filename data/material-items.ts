/**
 * Piezas unitarias semilla (ej. vinilos VIN de ISDIN). Cada itemCode es unico.
 * Sirven para el escenario ISDIN (ver docs/PICKING_BATCHES.md).
 */

import { MaterialItem } from "@/types";
import { seedBase } from "@/data/_helpers";

export const materialItems: MaterialItem[] = [
  {
    id: "itm_vin_31195",
    itemCode: "VIN-31195",
    clientId: "cli_isdin",
    campaignId: "cmp_isdin_vinilos",
    materialId: "mat_isdin_vinilo_a",
    name: "Vinilo ISDIN Farmacia Diagonal",
    type: "vinilo",
    heightCm: 120,
    widthCm: 200,
    pointOfSaleName: "Farmacia Diagonal",
    address: "Av. Diagonal 400",
    city: "Barcelona",
    province: "Barcelona",
    postalCode: "08008",
    week: "2026-W29",
    installer: "Instalador BCN 1",
    serviceId: "srv_isdin_bcn_001",
    serviceCode: "SRV-ISDIN-0001",
    location: "A-01",
    status: "recibido",
    notes: null,
    stockEntryId: "ent_0001",
    importBatchId: null,
    pickingBatchId: null,
    pickingLineId: null,
    shipmentId: null,
    incidentId: null,
    ...seedBase()
  },
  {
    id: "itm_vin_32137",
    itemCode: "VIN-32137",
    clientId: "cli_isdin",
    campaignId: "cmp_isdin_vinilos",
    materialId: "mat_isdin_vinilo_a",
    name: "Vinilo ISDIN Farmacia Sol",
    type: "vinilo",
    heightCm: 50,
    widthCm: 100,
    pointOfSaleName: "Farmacia Sol",
    address: "Puerta del Sol 1",
    city: "Madrid",
    province: "Madrid",
    postalCode: "28013",
    week: "2026-W30",
    installer: "Instalador MAD 1",
    serviceId: "srv_isdin_mad_002",
    serviceCode: "SRV-ISDIN-0002",
    location: "A-02",
    status: "recibido",
    notes: null,
    stockEntryId: "ent_0001",
    importBatchId: null,
    pickingBatchId: null,
    pickingLineId: null,
    shipmentId: null,
    incidentId: null,
    ...seedBase()
  },
  {
    id: "itm_vin_30954",
    itemCode: "VIN-30954",
    clientId: "cli_isdin",
    campaignId: "cmp_isdin_vinilos",
    materialId: "mat_isdin_vinilo_a",
    name: "Vinilo ISDIN Farmacia Diagonal 2",
    type: "vinilo",
    heightCm: 90,
    widthCm: 150,
    pointOfSaleName: "Farmacia Diagonal",
    address: "Av. Diagonal 400",
    city: "Barcelona",
    province: "Barcelona",
    postalCode: "08008",
    week: "2026-W29",
    installer: "Instalador BCN 1",
    serviceId: "srv_isdin_bcn_001",
    serviceCode: "SRV-ISDIN-0001",
    location: "A-01",
    status: "recibido",
    notes: null,
    stockEntryId: "ent_0001",
    importBatchId: null,
    pickingBatchId: null,
    pickingLineId: null,
    shipmentId: null,
    incidentId: null,
    ...seedBase()
  },
  // --- Escenario Banc Sabadell: visuales por oficina, preparacion por instalador ---
  ...sabadellItems()
];

/** Genera piezas de Banc Sabadell repartidas en oficinas y dos instaladores. */
function sabadellItems(): MaterialItem[] {
  const offices = [
    { code: "0001", name: "Oficina Gracia", city: "Barcelona", province: "Barcelona", installer: "Instalador Cat 1", route: "R-BCN-1" },
    { code: "0002", name: "Oficina Eixample", city: "Barcelona", province: "Barcelona", installer: "Instalador Cat 1", route: "R-BCN-1" },
    { code: "0003", name: "Oficina Sabadell Centre", city: "Sabadell", province: "Barcelona", installer: "Instalador Cat 2", route: "R-BCN-2" },
    { code: "0004", name: "Oficina Girona", city: "Girona", province: "Girona", installer: "Instalador Cat 2", route: "R-GIR-1" }
  ];
  const items: MaterialItem[] = [];
  offices.forEach((o) => {
    ["Visual entrada", "Vinilo escaparate"].forEach((visual, vi) => {
      items.push({
        id: `itm_sab_${o.code}_${vi}`,
        itemCode: `SAB-${o.code}-V${vi + 1}`,
        clientId: "cli_sabadell",
        campaignId: "cmp_sabadell_oficinas",
        materialId: null,
        name: `${visual} ${o.name}`,
        type: vi === 0 ? "carteleria" : "vinilo",
        heightCm: vi === 0 ? 80 : 200,
        widthCm: vi === 0 ? 120 : 150,
        pointOfSaleName: o.name,
        officeCode: o.code,
        address: `Calle ${o.name} 1`,
        city: o.city,
        province: o.province,
        postalCode: null,
        week: null,
        installer: o.installer,
        route: o.route,
        wave: "Oleada 1",
        serviceId: null,
        serviceCode: null,
        location: `SAB-${o.code}`,
        status: "recibido",
        notes: null,
        stockEntryId: null,
        importBatchId: null,
        pickingBatchId: null,
        pickingLineId: null,
        shipmentId: null,
        incidentId: null,
        ...seedBase()
      });
    });
  });
  return items;
}
