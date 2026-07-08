# Roles y permisos — MerchanLOGS

La matriz de permisos vive en `lib/permissions.ts` (`can(role, permission)`) y la
sesion activa (simulada) en `services/session.ts` + `components/session-provider.tsx`.
La navegacion y las acciones de la UI se filtran con `can(...)`.

> En esta fase **no hay autenticacion real**. El usuario/rol activo se selecciona
> en la barra superior y se guarda en `localStorage`. Los usuarios de rol
> **Gestor** seran, al integrar Supabase, los mismos que en MerchanOPS.

## Roles

1. **Administracion** — acceso total.
2. **Gestor** — consulta general; crea peticiones e incidencias.
3. **Almacen** — opera stock, picking, envios e incidencias.

## Matriz de permisos (resumen)

| Accion | Administracion | Gestor | Almacen |
|--------|:---:|:---:|:---:|
| Ver clientes/campanas/servicios | ✅ | ✅ | ✅ |
| Gestionar clientes/campanas/servicios | ✅ | ❌ | ❌ |
| Ver materiales | ✅ | ✅ | ✅ |
| Gestionar materiales | ✅ | ❌ | ✅ |
| Ajustar stock | ✅ | ❌ | ✅ |
| Ver entradas | ✅ | ✅ | ✅ |
| Registrar/gestionar entradas | ✅ | ❌ | ✅ |
| Ver movimientos | ✅ | ✅ | ✅ |
| Eliminar movimientos | ✅ | ❌ | ❌ |
| Ver peticiones | ✅ | ✅ | ✅ |
| Crear peticiones | ✅ | ✅ | ✅ |
| Editar peticiones (gestion completa) | ✅ | ❌ | ❌ |
| Cambiar estado de peticiones | ✅ | ❌ | ✅ |
| Eliminar peticiones | ✅ | ❌ | ❌ |
| Picking / preparacion | ✅ | 👁️ ver | ✅ |
| Ver envios | ✅ | ✅ | ✅ |
| Gestionar envios | ✅ | ❌ | ✅ |
| Ver incidencias | ✅ | ✅ | ✅ |
| Crear incidencias | ✅ | ✅ | ✅ |
| Gestionar incidencias (estado/editar/eliminar) | ✅ | ❌ | ✅ |
| Gestionar usuarios / configuracion | ✅ | ❌ | ❌ |

Notas de diseno, segun el brief:

- **Gestor**: no puede modificar stock critico ni eliminar movimientos de almacen
  ni borrar registros logisticos sensibles. Puede crear peticiones e incidencias.
- **Almacen**: registra entradas, modifica stock, prepara picking, marca estados,
  registra envios y crea incidencias; **no** gestiona usuarios ni configuracion.
- **Administracion**: acceso total, incluida la gestion de maestros y el borrado.

## Como se integrara con MerchanOPS

- `Role` (`administracion`/`gestor`/`almacen`) se mapeara a los roles/permisos de
  MerchanOPS. Los gestores compartiran identidad (Supabase Auth).
- `createdBy`/`updatedBy`/`assignedTo` guardan ids de usuario, listos para
  resolverse contra el maestro de usuarios comun.
- Sustituir `services/session.ts` por la sesion real de Supabase Auth no requiere
  cambios en `permissions.ts` ni en la UI.

---

## Actualizacion fase 2: nuevos permisos

| Accion | Administracion | Gestor | Almacen |
|--------|:---:|:---:|:---:|
| Ver carga masiva / importaciones (`imports.view`) | ✅ | ✅ | ✅ |
| Confirmar importaciones (`imports.manage`) | ✅ | ❌ | ✅ |
| Simular solicitud desde OPS (`ops.simulate`) | ✅ | ❌ | ❌ |
| Ver piezas unitarias (VIN) | ✅ | ✅ | ✅ |
| Crear/gestionar picking agrupado (`picking.manage`) | ✅ | 👁️ ver | ✅ |
| Cerrar picking (descuenta stock) | ✅ | ❌ | ✅ |

El picking agrupado, el cierre (con descuento de stock) y la confirmacion de
importaciones son operaciones de **almacen** (y administracion). El gestor solo
consulta. La simulacion OPS es una herramienta de pruebas restringida a
administracion en esta fase.
