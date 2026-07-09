/** Usuarios/roles semilla (sesion simulada, sin auth real). */

import { User } from "@/types";
import { seedBase } from "@/data/_helpers";

export const users: User[] = [
  {
    id: "admin",
    username: "admin",
    displayName: "Administracion",
    email: "admin@merchanservis.com",
    role: "administracion",
    active: true,
    provinces: [],
    ...seedBase()
  },
  {
    // Los gestores seran, en el futuro, los mismos usuarios de MerchanOPS.
    id: "gestor_1",
    username: "gestor1",
    displayName: "Gestor Campanas",
    email: "gestor1@merchanservis.com",
    role: "gestor",
    active: true,
    provinces: ["Barcelona", "Madrid"],
    ...seedBase({ merchanOpsId: "merchanops_user_gestor1", sourceSystem: "merchanops" })
  },
  {
    id: "almacen_1",
    username: "almacen1",
    displayName: "Operario Almacen",
    email: "almacen1@merchanservis.com",
    role: "almacen",
    active: true,
    provinces: [],
    ...seedBase()
  }
];
