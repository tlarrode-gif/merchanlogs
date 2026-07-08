/** Clientes / CECOs semilla. */

import { Client } from "@/types";
import { seedBase } from "@/data/_helpers";

export const clients: Client[] = [
  {
    id: "cli_isdin",
    name: "ISDIN",
    ceco: "CECO-ISDIN-01",
    description: "Laboratorio dermatologico. Campanas de vinilos a medida en farmacias.",
    active: true,
    ...seedBase({ merchanOpsId: "merchanops_client_isdin", sourceSystem: "merchanops" })
  },
  {
    id: "cli_revlon",
    name: "Revlon",
    ceco: "CECO-REVLON-01",
    description: "Cosmetica. Logistica de material promocional.",
    active: true,
    ...seedBase()
  },
  {
    id: "cli_nestle",
    name: "Nestle",
    ceco: "CECO-NESTLE-01",
    description: "Alimentacion. Acciones en punto de venta.",
    active: true,
    ...seedBase()
  },
  {
    id: "cli_mondelez",
    name: "Mondelez",
    ceco: "CECO-MDLZ-01",
    description: "Gran consumo. Material PLV y displays.",
    active: true,
    ...seedBase()
  },
  {
    id: "cli_sabadell",
    name: "Banco Sabadell",
    ceco: "CECO-SABADELL-01",
    description: "Banca. Cambio visual de oficinas.",
    active: true,
    ...seedBase()
  },
  {
    id: "cli_kiwoko",
    name: "Kiwoko / Tiendanimal",
    ceco: "CECO-KIWOKO-01",
    description: "Retail mascotas. Carteleria y PLV en tienda.",
    active: true,
    ...seedBase()
  },
  {
    id: "cli_generico",
    name: "Cliente Generico",
    ceco: "CECO-GEN-01",
    description: "Cliente generico para material sin asignar.",
    active: true,
    ...seedBase()
  }
];
