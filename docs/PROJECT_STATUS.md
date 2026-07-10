# Estado del proyecto — MerchanLOGS (MVP Fase 1)

Fecha: 2026-07 · Rama: `claude/merchanlogs-mvp-phase-1-mnggha`

## 1. Que se ha construido

Aplicacion Next.js 14 (App Router) + TypeScript + Tailwind, alineada con el
stack de MerchanOPS, con arquitectura por capas:

- **`types/`**: tipos centrales.
  - `base.ts`: `BaseEntity` con **campos de sincronizacion** (`id`, `externalId`,
    `merchanOpsId`, `sourceSystem`, `syncStatus`, `lastSyncedAt`, `createdAt`,
    `updatedAt`, `createdBy`, `updatedBy`) y `defaultSyncFields()`.
  - `enums.ts`: roles y todos los estados del dominio como uniones de literales.
  - `entities.ts`: 11 entidades logisticas.
  - `index.ts`: `CollectionName`, `CollectionTypeMap`, `DataStore`.
- **`data/`**: datos locales semilla (mock) deterministas.
- **`services/`**: capa de acceso a datos desacoplada + logica de dominio.
  - `adapter.ts` (contrato `DataAdapter` + `getAdapter()`), `local-adapter.ts`
    (memoria + `localStorage`), `crud.ts` (factory CRUD generico), `session.ts`
    (sesion simulada) y servicios por dominio: `catalog`, `stock`, `entries`,
    `requests`, `picking`, `shipments`, `incidents`, `dashboard`.
- **`lib/`**: `ids`, `dates`, `status` (etiquetas, colores y transiciones),
  `permissions` (matriz rol→permiso + `can()`), `validation`, `supabase`
  (preparado, sin conectar).
- **`app/`**: 11 modulos (dashboard + 10 secciones) y shell con navegacion
  filtrada por permisos y selector de usuario/rol.
- **`components/`**: kit de UI, `SessionProvider`, hooks `useData`/`useCatalog`.
- **`docs/`**: esta documentacion.

## 2. Que funciona (verificado)

- `npm run lint` → **sin errores ni warnings**.
- `npm run build` → **compila** y typecheck correcto; 14 rutas generadas.
- Arranque (`npm run start`) verificado: todas las rutas responden 200.
- Render de datos en cliente verificado (navegador headless) en dashboard,
  materiales, peticiones, picking e incidencias.
- **Flujo de negocio verificado end-to-end** (picking): preparar 1 unidad
  descuenta stock (12 → 11), registra un movimiento `preparacion` y transiciona
  la peticion a `pendiente_material` al detectar falta de stock en otra linea.

Reglas de dominio implementadas:

- **Entrada recibida → stock**: al crear/marcar una entrada como `recibida` o
  `parcialmente_recibida` se incrementa el stock del material y se genera un
  movimiento `entrada` (una sola vez, controlando el estado previo).
- **Ajuste de stock**: cambia el stock y genera movimiento `ajuste`; no permite
  stock negativo.
- **Picking**: descuenta stock (movimiento `preparacion`), detecta falta de
  stock, y deriva el estado de la peticion (`pendiente_material` /
  `lista_para_envio`).
- **Envio desde peticion**: crea el envio y marca la peticion como `enviada`.
- **Maquinas de estado**: peticiones, envios, incidencias y entradas validan las
  transiciones permitidas (`lib/status.ts`).
- **Permisos por rol**: la navegacion y las acciones se filtran segun el rol
  activo (Administracion / Gestor / Almacen).

## 3. Que queda pendiente (siguientes fases)

- Conexion real a **Supabase** (implementar `SupabaseAdapter`) — ver
  `docs/SYNC_PREPARATION.md`.
- **Autenticacion real** compartida con MerchanOPS (Supabase Auth). Hoy la sesion
  es simulada.
- Sincronizacion bidireccional con **MerchanOPS** (peticiones e incidencias
  entrantes; estado logistico saliente).
- Integracion con **transportista** (ej. Nacex) para tracking real de envios.
- Recepcion de incidencias de campo desde **MerchanGO** y publicacion de
  incidencias criticas a **MerchanVIEW**.
- UX/UI definitiva (esta fase prioriza funcionalidad, no diseno).
- Reserva de stock formal (hoy el picking descuenta directamente; existe el tipo
  de movimiento `reserva` para modelarlo si se desea separar reserva de salida).
- Tests automatizados (unit/e2e). Se ha verificado manualmente y con un script
  de humo; falta suite formal.
- Paginacion/busqueda/filtros avanzados en listados (hoy listados simples).

## 4. Limitaciones actuales

- **Persistencia local**: los datos viven en memoria + `localStorage` del
  navegador. No hay backend; cada navegador tiene su copia. "Reiniciar datos"
  vuelve a la semilla.
- **Sin concurrencia**: los codigos secuenciales (PET/ENV/INC) se calculan en
  cliente; Supabase lo resolvera con secuencias.
- **Editar stock desde el formulario de material** no genera movimiento (aviso en
  el propio formulario); para trazabilidad debe usarse el boton "Ajustar".
- **Eliminar** una entrada ya aplicada no revierte el stock (se avisa). Es una
  decision consciente para el MVP; en produccion se modelaria con una reversa.
- `strict: false` en TypeScript (heredado de MerchanOPS) reduce garantias de
  tipos frente a `null`.

## 5. Proximos pasos recomendados

1. Definir el proyecto Supabase y aplicar `docs/SUPABASE_SCHEMA_DRAFT.md`.
2. Implementar `services/supabase-adapter.ts` con la interfaz `DataAdapter`.
3. Sustituir la sesion simulada por Supabase Auth (reutilizando usuarios de
   MerchanOPS para el rol Gestor).
4. Implementar los flujos de entrada/salida con MerchanOPS descritos en
   `docs/SYNC_PREPARATION.md`.
5. Anadir tests automatizados sobre la capa de servicios (logica de stock/estados).

---

## Fase 2 — Auditoria y mejora operativa (actualizacion)

### Construido en fase 2

- **Regla de stock corregida**: el stock fisico se descuenta **solo al cerrar el
  picking** (`salida_picking`). Nuevo `reservedStock` y `availableStock`.
- **`MaterialItem`**: piezas unitarias con `itemCode` unico (vinilos VIN de ISDIN)
  y deteccion de duplicados.
- **Carga masiva** (`/importaciones`): copiar/pegar desde Excel con
  previsualizacion, validacion y duplicados (ISDIN, Banc Sabadell, generico).
- **`PickingBatch`** (`/picking`): picking agrupado por instalador/oficina/
  provincia/ruta/tipo. Detalle, preparacion, incidencias, cierre y **hoja
  imprimible** (`/picking/[id]/print`).
- **Incidencias** enlazadas a picking/pieza/import y con `blocksPicking`.
- **Simulacion de solicitud OPS** (`/solicitudes-ops`) con campos de sync.
- **Envio desde picking** (`createShipmentFromPicking`).

### Verificado end-to-end (navegador headless)

- Import ISDIN con `VIN` duplicado: se detecta y **no** se duplica la pieza.
- Regla de stock: crear picking no descuenta (reserva), preparar no descuenta,
  **cerrar descuenta** solo lo preparado (cierre parcial correcto).
- Banc Sabadell: picking agrupado **por instalador** con las piezas del instalador.
- `lint`, `tsc --noEmit` y `build` en verde (17 rutas).

### Pendiente (siguientes fases)

- Import desde ficheros `.xlsx`/`.csv` (hoy solo copiar/pegar TSV).
- Conexion real Supabase/MerchanOPS y auth compartida.
- Avisos por email en el flujo OPS (estructura preparada, sin enviar).

---

## Fase 3a — Conexion Supabase en SOLO LECTURA (nuevo)

Decision confirmada: MerchanLOGS comparte el proyecto Supabase de MerchanOPS y
sera co-propietario de las tablas `logistics_*` (el backend logistico YA existe
en produccion; no se crea esquema nuevo). Ver docs/SUPABASE_RECONCILIATION.md.

- **`services/supabase-adapter.ts`**: implementacion de `DataAdapter` con
  mapeadores por coleccion contra las tablas reales: join materiales+stock,
  colapso de lineas (peticiones, pickings, entradas), mapeo tolerante de
  estados ES-DB → dominio, y campos de sync (`merchanOpsId`, `sourceSystem:
  "merchanops"`, `syncStatus: "synced"`).
- **Activacion por entorno**: `NEXT_PUBLIC_DATA_SOURCE=supabase` + claves en
  `.env`. Por defecto la app sigue 100% en datos locales.
- **Guardas**: escrituras bloqueadas con error explicativo (fase 3a),
  `reset()` bloqueado SIEMPRE (jamas re-sembrar la base compartida);
  `requestHistory` e `importBatches` (sin tabla) siguen en local.
- Tests: 22 en verde (guardas del adapter incluidas). La verificacion de
  lectura en vivo queda pendiente de un entorno con salida de red a
  `*.supabase.co` (el sandbox actual la bloquea) o del deploy.

Proximo (fase 3b): escritura entidad a entidad empezando por stock/pickings,
previa migracion a Supabase Auth + RLS (ver docs/SECURITY_AUDIT.md).

---

## Fase 3b — Escritura en Supabase (nuevo)

MerchanLOGS ya **escribe** en las tablas `logistics_*` compartidas (materiales,
stock, movimientos, piezas VIN, entradas, peticiones, pickings, envios e
incidencias). Reglas implementadas en `services/supabase-adapter.ts` y
documentadas en `docs/SUPABASE_RECONCILIATION.md`:

- Maestros de OPS (clients/campanas/servicios/usuarios): solo lectura SIEMPRE.
- Mapas inversos dominio→DB que solo emiten valores admitidos por los CHECK
  constraints reales del DB (test dedicado que lo garantiza).
- IDs generados por el DB; columnas uuid protegidas frente a ids locales.
- Movimientos de stock inmutables; `reset()` bloqueado; `activo` de materiales
  no se toca desde LOGS.
- Doble barrera de stock: validacion de dominio + CHECK del DB (sin negativos
  ni sobre-reserva).

Verificacion: lint, tsc, build (18 rutas) y **35 tests en verde** (13 nuevos:
guardas de co-propiedad y validacion de vocabulario contra los CHECK).
La prueba de escritura en vivo se hara desde el deploy (el sandbox no tiene
salida de red); usar /estado para diagnostico de conexion.

Pendiente fase 3c: Supabase Auth compartida + RLS antes de dar acceso a
usuarios finales (hoy la base no tiene RLS y ambas apps usan la anon key).

---

## Fase 3 (en curso) — Endurecimiento de la regla de stock + tests

Auditoria de la capa de dominio y correccion de incoherencias entre la logica y
su documentacion, mas la primera suite de tests automatizada.

### Corregido

- **`reserveStock` ahora valida disponible.** Antes solo sumaba a `reservedStock`
  sin comprobar nada (el docstring decia que bloqueaba, pero no lo hacia): se
  podia reservar mas que el stock fisico y dejar `availableStock` negativo. Ahora
  bloquea si la reserva supera `disponible = fisico - reservado`. Como
  `createPickingFromRequest` reserva al crear, esto impide crear pickings sin
  material real. (`services/stock.service.ts`)
- **`getStockCoverage` usa disponible, no fisico puro.** Antes calculaba la
  cobertura con `currentStock`, ignorando reservas de otros pickings (dos batches
  se mostraban ambos "cubiertos" sobre el mismo stock). Ahora usa
  `availableStock` excluyendo la reserva propia del batch para no penalizarse a si
  mismo. (`services/picking.service.ts`)
- **Estado de linea `cancelada` operativo.** Existia en el tipo y en
  `deriveBatchStatus` pero ningun flujo lo asignaba (rama muerta). Se anade
  `cancelLine()` en el servicio y un boton "Cancelar" en el detalle de picking;
  la reserva de una linea cancelada se libera al cerrar y no consume stock.

### Tests automatizados (nuevo)

- **Vitest** configurado con el alias `@/*` (`vitest.config.ts`). Los tests corren
  en Node sobre el `LocalAdapter` en memoria; `reset()` aisla cada caso.
- `npm test` → **18 tests en verde** cubriendo la regla de stock:
  - `tests/stock.test.ts`: `availableStock`, `reserveStock` (incluida la nueva
    validacion de disponible), `releaseReservation`, `applyStockDelta` (sin
    negativos, estado `agotado`).
  - `tests/picking.test.ts`: reserva al crear (no descuenta), descuento solo al
    cerrar, cierre parcial, idempotencia, linea cancelada y cobertura.
- `lint` y `build` (17 rutas) siguen en verde.

### Pendiente (siguientes fases)

- Import desde ficheros `.xlsx`/`.csv` (hoy solo copiar/pegar TSV).
- Conexion real Supabase/MerchanOPS y auth compartida.
- Avisos por email en el flujo OPS (estructura preparada, sin enviar).
- Ampliar cobertura de tests a entradas, envios, incidencias y maquinas de estado.
