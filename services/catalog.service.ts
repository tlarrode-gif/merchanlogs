/**
 * Servicios CRUD del catalogo: clientes/CECOs, campanas, servicios y materiales.
 * Se agrupan aqui por ser CRUD directo sin logica de dominio compleja.
 */

import { makeCrud } from "@/services/crud";

export const clientsService = makeCrud("clients", "cli");
export const campaignsService = makeCrud("campaigns", "cmp");
export const servicesService = makeCrud("services", "srv");
export const materialsService = makeCrud("materials", "mat");
