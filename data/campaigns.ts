/** Campanas semilla, vinculadas a clientes/CECOs. */

import { Campaign } from "@/types";
import { seedBase } from "@/data/_helpers";

export const campaigns: Campaign[] = [
  {
    id: "cmp_isdin_vinilos",
    clientId: "cli_isdin",
    ceco: "CECO-ISDIN-01",
    campaignName: "ISDIN Vinilos Farmacias 2026",
    description: "Instalacion de vinilos a medida en farmacias. Material a producir por semana de instalacion.",
    startDate: "2026-06-01T00:00:00.000Z",
    endDate: "2026-09-30T00:00:00.000Z",
    status: "activa",
    ...seedBase({ merchanOpsId: "merchanops_campaign_isdin_vinilos", sourceSystem: "merchanops" })
  },
  {
    id: "cmp_revlon_material",
    clientId: "cli_revlon",
    ceco: "CECO-REVLON-01",
    campaignName: "Revlon Logistica de Material",
    description: "Distribucion de material promocional a puntos de venta.",
    startDate: "2026-05-15T00:00:00.000Z",
    endDate: "2026-08-15T00:00:00.000Z",
    status: "activa",
    ...seedBase()
  },
  {
    id: "cmp_nestle_pdv",
    clientId: "cli_nestle",
    ceco: "CECO-NESTLE-01",
    campaignName: "Nestle Acciones PDV",
    description: "Acciones en punto de venta con displays y carteleria.",
    startDate: "2026-06-10T00:00:00.000Z",
    endDate: "2026-07-31T00:00:00.000Z",
    status: "activa",
    ...seedBase()
  },
  {
    id: "cmp_sabadell_oficinas",
    clientId: "cli_sabadell",
    ceco: "CECO-SABADELL-01",
    campaignName: "Sabadell Cambio Visual Oficinas",
    description: "Renovacion visual de oficinas bancarias.",
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-12-31T00:00:00.000Z",
    status: "planificada",
    ...seedBase()
  },
  {
    id: "cmp_generica",
    clientId: "cli_generico",
    ceco: "CECO-GEN-01",
    campaignName: "Campana Generica",
    description: "Campana generica para pruebas.",
    startDate: null,
    endDate: null,
    status: "borrador",
    ...seedBase()
  }
];
