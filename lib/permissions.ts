/**
 * Sistema de permisos basado en roles.
 *
 * En esta fase la sesion es simulada (ver services/session.ts). La matriz de
 * permisos queda centralizada aqui para que la UI no hardcodee reglas y para
 * que, al integrar Supabase Auth con MerchanOPS, solo haya que sustituir el
 * origen del rol activo, no la logica de autorizacion.
 */

import { Role } from "@/types/enums";

/** Acciones controlables en la aplicacion. */
export type Permission =
  // Clientes / CECOs
  | "clients.view"
  | "clients.manage"
  // Campanas
  | "campaigns.view"
  | "campaigns.manage"
  // Servicios
  | "services.view"
  | "services.manage"
  // Materiales
  | "materials.view"
  | "materials.manage"
  // Entradas / stock
  | "entries.view"
  | "entries.manage"
  | "stock.adjust"
  | "movements.view"
  | "movements.delete"
  // Peticiones
  | "requests.view"
  | "requests.create"
  | "requests.manage"
  | "requests.changeStatus"
  | "requests.delete"
  // Picking
  | "picking.view"
  | "picking.manage"
  // Importaciones / carga masiva
  | "imports.view"
  | "imports.manage"
  // Simulacion de solicitud desde OPS (herramienta de pruebas)
  | "ops.simulate"
  // Envios
  | "shipments.view"
  | "shipments.manage"
  // Incidencias
  | "incidents.view"
  | "incidents.create"
  | "incidents.manage"
  // Administracion
  | "users.manage"
  | "settings.manage";

const ALL: Permission[] = [
  "clients.view", "clients.manage",
  "campaigns.view", "campaigns.manage",
  "services.view", "services.manage",
  "materials.view", "materials.manage",
  "entries.view", "entries.manage", "stock.adjust", "movements.view", "movements.delete",
  "requests.view", "requests.create", "requests.manage", "requests.changeStatus", "requests.delete",
  "picking.view", "picking.manage",
  "imports.view", "imports.manage",
  "ops.simulate",
  "shipments.view", "shipments.manage",
  "incidents.view", "incidents.create", "incidents.manage",
  "users.manage", "settings.manage"
];

/**
 * Matriz rol -> permisos. Refleja los permisos orientativos del brief:
 * - Administracion: acceso total.
 * - Gestor: consulta general, crea peticiones e incidencias, sin tocar stock ni
 *   borrar registros sensibles.
 * - Almacen: opera stock/picking/envios/incidencias, sin gestion de usuarios.
 */
const rolePermissions: Record<Role, Permission[]> = {
  administracion: ALL,
  gestor: [
    "clients.view",
    "campaigns.view",
    "services.view",
    "materials.view",
    "entries.view",
    "movements.view",
    "requests.view", "requests.create",
    "picking.view",
    "imports.view",
    "shipments.view",
    "incidents.view", "incidents.create"
  ],
  almacen: [
    "clients.view",
    "campaigns.view",
    "services.view",
    "materials.view", "materials.manage",
    "entries.view", "entries.manage", "stock.adjust", "movements.view",
    "requests.view", "requests.create", "requests.changeStatus",
    "picking.view", "picking.manage",
    "imports.view", "imports.manage",
    "shipments.view", "shipments.manage",
    "incidents.view", "incidents.create", "incidents.manage"
  ]
};

export function permissionsForRole(role: Role): Permission[] {
  return rolePermissions[role] ?? [];
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
}

export const roleLabels: Record<Role, string> = {
  administracion: "Administracion",
  gestor: "Gestor",
  almacen: "Almacen"
};
