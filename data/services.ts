/** Servicios logisticos semilla, vinculados a campana y punto de venta. */

import { Service } from "@/types";
import { seedBase } from "@/data/_helpers";

export const services: Service[] = [
  {
    id: "srv_isdin_bcn_001",
    clientId: "cli_isdin",
    campaignId: "cmp_isdin_vinilos",
    serviceName: "Vinilo escaparate Farmacia Diagonal",
    serviceCode: "SRV-ISDIN-0001",
    pointOfSaleName: "Farmacia Diagonal",
    pointOfSaleType: "farmacia",
    address: "Av. Diagonal 400",
    city: "Barcelona",
    province: "Barcelona",
    postalCode: "08008",
    scheduledDate: "2026-07-14T00:00:00.000Z",
    installationWeek: "2026-W29",
    logisticsStatus: "en_preparacion",
    materialsRequired: ["mat_isdin_vinilo_a", "mat_isdin_vinilo_b"],
    notes: "Vinilo a medida. Confirmar alto/ancho antes de producir.",
    ...seedBase({ merchanOpsId: "merchanops_service_isdin_0001", sourceSystem: "merchanops" })
  },
  {
    id: "srv_isdin_mad_002",
    clientId: "cli_isdin",
    campaignId: "cmp_isdin_vinilos",
    serviceName: "Vinilo mostrador Farmacia Sol",
    serviceCode: "SRV-ISDIN-0002",
    pointOfSaleName: "Farmacia Sol",
    pointOfSaleType: "farmacia",
    address: "Puerta del Sol 1",
    city: "Madrid",
    province: "Madrid",
    postalCode: "28013",
    scheduledDate: "2026-07-21T00:00:00.000Z",
    installationWeek: "2026-W30",
    logisticsStatus: "pendiente",
    materialsRequired: ["mat_isdin_vinilo_b"],
    notes: "Pendiente de medidas definitivas.",
    ...seedBase({ merchanOpsId: "merchanops_service_isdin_0002", sourceSystem: "merchanops" })
  },
  {
    id: "srv_nestle_001",
    clientId: "cli_nestle",
    campaignId: "cmp_nestle_pdv",
    serviceName: "Montaje display supermercado Sants",
    serviceCode: "SRV-NESTLE-0001",
    pointOfSaleName: "Supermercado Sants",
    pointOfSaleType: "supermercado",
    address: "Carrer de Sants 100",
    city: "Barcelona",
    province: "Barcelona",
    postalCode: "08028",
    scheduledDate: "2026-07-10T00:00:00.000Z",
    installationWeek: "2026-W28",
    logisticsStatus: "material_listo",
    materialsRequired: ["mat_nestle_display"],
    notes: null,
    ...seedBase()
  },
  {
    id: "srv_sabadell_001",
    clientId: "cli_sabadell",
    campaignId: "cmp_sabadell_oficinas",
    serviceName: "Cambio visual oficina Gracia",
    serviceCode: "SRV-SABADELL-0001",
    pointOfSaleName: "Oficina Sabadell Gracia",
    pointOfSaleType: "oficina_bancaria",
    address: "Gran de Gracia 20",
    city: "Barcelona",
    province: "Barcelona",
    postalCode: "08012",
    scheduledDate: "2026-08-01T00:00:00.000Z",
    installationWeek: "2026-W31",
    logisticsStatus: "pendiente",
    materialsRequired: ["mat_sabadell_carteleria"],
    notes: null,
    ...seedBase()
  }
];
