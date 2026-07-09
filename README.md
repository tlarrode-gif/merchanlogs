# MerchanLOGS

Plataforma logistica interna del ecosistema **Merchanservis**. Gestiona
entradas de material, stock, movimientos de almacen, peticiones logisticas,
picking/preparacion, envios e incidencias, con las relaciones entre cliente/CECO,
campana, servicio, material y punto de venta.

> **Fase actual: MVP funcional (fase 1).** Trabaja con **datos locales** (mock).
> NO esta conectado a Supabase ni a MerchanOPS todavia, pero toda la arquitectura
> queda preparada para esa sincronizacion futura. Ver `docs/SYNC_PREPARATION.md`.

## Stack detectado / utilizado

Se ha respetado el stack del ecosistema Merchanservis (mismo que **MerchanOPS**)
para facilitar la futura convivencia e integracion:

- **Next.js 14** (App Router)
- **React 18** + **TypeScript** (config identica a MerchanOPS: `strict: false`, alias `@/*` a la raiz)
- **Tailwind CSS 3**
- **@supabase/supabase-js** (instalado y preparado, **sin conectar**)
- ESLint (`next/core-web-vitals`)

## Como instalar

```bash
npm install
```

## Como ejecutar

```bash
npm run dev      # desarrollo en http://localhost:3000
npm run build    # build de produccion
npm run start    # sirve el build
npm run lint     # ESLint
npm test         # tests de la capa de servicios (Vitest)
```

No requiere variables de entorno en esta fase (usa datos locales). El fichero
`.env.example` deja preparadas las variables de Supabase para el futuro.

## Uso basico

- La app arranca con un **usuario simulado** (por defecto *Administracion*).
  En la barra superior puedes **cambiar de usuario/rol** (Administracion, Gestor,
  Almacen) para probar los permisos.
- El boton **"Reiniciar datos"** (barra superior) restablece los datos locales a
  la semilla inicial. Los datos se persisten en `localStorage` del navegador.

## Modulos incluidos

| Modulo | Ruta | Descripcion |
|--------|------|-------------|
| Dashboard | `/` | KPIs operativos, ultimos movimientos e incidencias |
| Clientes / CECOs | `/clientes` | Alta y gestion de clientes y centros de coste |
| Campanas | `/campanas` | Campanas vinculadas a cliente/CECO |
| Servicios | `/servicios` | Servicios logisticos (PDV, provincia, materiales, semana ISDIN) |
| Materiales | `/materiales` | Inventario agregado, stock fisico / reservado / disponible, ajuste con trazabilidad |
| Piezas (VIN) | `/piezas` | Piezas unitarias individuales (ej. vinilos VIN de ISDIN), codigo unico |
| Carga masiva | `/importaciones` | Importacion copiar/pegar desde Excel (ISDIN, Banc Sabadell, generico) |
| Entradas | `/entradas` | Recepcion de material (actualiza stock al recibir) |
| Movimientos | `/movimientos` | Historico automatico de movimientos de stock |
| Peticiones | `/peticiones` | Modulo central de peticiones + historico de estados |
| Solicitudes OPS | `/solicitudes-ops` | Simulacion local de peticiones entrantes de MerchanOPS |
| Picking agrupado | `/picking` | PickingBatch por instalador/oficina/ruta; cierre descuenta stock; hoja imprimible |
| Envios | `/envios` | Registro de envios (tracking preparado para transportista futuro) |
| Incidencias | `/incidencias` | Incidencias vinculables a cualquier entidad (incluye picking) y bloqueo de cierre |

### Regla de stock (fase 2)

El stock fisico (`currentStock`) **solo se descuenta al cerrar el picking**
(movimiento `salida_picking`). Crear un picking **reserva** (`reservedStock`), y
preparar lineas **no** descuenta stock. Disponible = fisico − reservado.
Ver `docs/PICKING_BATCHES.md` y `docs/AUDIT_REPORT.md`.

## Estado actual

- MVP funcional y navegable, con CRUD, estados, permisos por rol y relaciones
  entre entidades operando sobre datos locales.
- Reglas de negocio implementadas: recepcion de entrada a stock + movimiento;
  ajuste de stock con movimiento; picking con descuento de stock + movimiento +
  transicion de estado; envio desde peticion; maquinas de estado validadas.
- **Build y lint en verde.** Verificado el arranque y el flujo de picking
  end-to-end (ver `docs/PROJECT_STATUS.md`).

## Estructura del proyecto

```
app/            Paginas (App Router). Un modulo por carpeta.
components/     UI reutilizable, provider de sesion y hooks de datos.
services/       Capa de acceso a datos (adapter) y logica de dominio (*.service.ts).
data/           Datos locales semilla (mock).
types/          Tipos centrales: base + sync, enums/estados, entidades.
lib/            Utilidades: ids, fechas, estados, permisos, validaciones, supabase.
docs/           Documentacion tecnica.
```

La UI **solo** habla con `services/`; los servicios **solo** hablan con el
`DataAdapter`. Cambiar de datos locales a Supabase implica implementar un
`SupabaseAdapter` y cambiar `getAdapter()` en `services/adapter.ts`, sin tocar
ni la UI ni la logica de dominio.

## Documentacion

- `docs/PROJECT_STATUS.md` — que se ha construido, que funciona, que queda pendiente.
- `docs/AUDIT_REPORT.md` — auditoria funcional (fase 2): hallazgos y correcciones.
- `docs/BULK_IMPORTS.md` — carga masiva copiar/pegar (plantillas ISDIN y Banc Sabadell).
- `docs/PICKING_BATCHES.md` — picking agrupado, criterios, cierre y regla de stock.
- `docs/PICKING_PRINT_SHEETS.md` — hojas de picking imprimibles.
- `docs/OPS_REQUEST_FLOW.md` — simulacion de solicitud desde MerchanOPS.
- `docs/SYNC_PREPARATION.md` — preparacion de la sincronizacion con MerchanOPS/Supabase.
- `docs/DATA_MODEL.md` — modelo de datos y relaciones.
- `docs/SUPABASE_SCHEMA_DRAFT.md` — borrador de esquema SQL (sin activar).
- `docs/ROLES_AND_PERMISSIONS.md` — roles y matriz de permisos.
