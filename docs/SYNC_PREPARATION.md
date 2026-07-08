# Preparacion de sincronizacion — MerchanLOGS ↔ MerchanOPS / Supabase

Este documento explica **como** MerchanLOGS quedaria conectado con MerchanOPS y
Supabase mas adelante, y **que** se ha dejado preparado para ello.

> Estado: **NADA esta sincronizado todavia.** MerchanLOGS usa datos locales. Este
> documento describe el plan y la preparacion existente en el codigo.

## 1. Principio de diseno: capa de datos intercambiable

La UI y la logica de dominio nunca acceden directamente a los datos. Todo pasa
por el contrato `DataAdapter` (`services/adapter.ts`):

```
UI (app/) → services/*.service.ts → getAdapter(): DataAdapter → LocalAdapter (hoy)
                                                              → SupabaseAdapter (futuro)
```

Activar Supabase consiste en:

1. Implementar `services/supabase-adapter.ts` (misma interfaz `list/get/insert/update/remove/reset`).
2. Devolverlo desde `getAdapter()` cuando `NEXT_PUBLIC_DATA_SOURCE === "supabase"`.
3. Rellenar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ver
   `.env.example`). El cliente ya existe en `lib/supabase.ts`.

No haria falta tocar ni las pantallas ni los servicios de dominio.

## 2. Campos de integracion (ya presentes en todas las entidades)

Cada entidad extiende `BaseEntity` (`types/base.ts`), que incluye:

| Campo | Uso en la sincronizacion |
|-------|--------------------------|
| `id` | Identificador interno de MerchanLOGS. |
| `externalId` | Id en un sistema externo generico (import, proveedor, MerchanGO). |
| `merchanOpsId` | Id del registro equivalente en MerchanOPS (clave de mapeo). |
| `sourceSystem` | Origen del registro: `merchanlogs`, `merchanops`, `merchango`, `merchanview`, `import`, `manual`. |
| `syncStatus` | `local`, `pending`, `synced`, `conflict`, `error`. |
| `lastSyncedAt` | Marca temporal de la ultima sincronizacion. |
| `createdAt` / `updatedAt` | Auditoria temporal (base para deltas incrementales). |
| `createdBy` / `updatedBy` | Usuario responsable (mapeable a Supabase Auth). |

`defaultSyncFields()` los inicializa al crear cualquier registro local
(`sourceSystem: "merchanlogs"`, `syncStatus: "local"`).

## 3. Entidades que deberian sincronizarse

| Entidad | Direccion prevista | Notas |
|---------|--------------------|-------|
| Clientes / CECOs | MerchanOPS → LOGS | Maestro en MerchanOPS. |
| Campanas | MerchanOPS → LOGS | Maestro en MerchanOPS (`merchanOpsId`, `campaignName`). |
| Servicios | MerchanOPS → LOGS | Incluye PDV, provincia, semana ISDIN. |
| Usuarios (gestores) | MerchanOPS → LOGS | Mismos usuarios via Supabase Auth. |
| Peticiones logisticas | Bidireccional | MerchanOPS puede crear; LOGS actualiza estado. |
| Incidencias | Bidireccional | Origen LOGS, MerchanOPS o MerchanGO. |
| Materiales / Stock / Movimientos | Local (LOGS) | Maestro logistico; se expone estado, no se importa. |
| Entradas | Local (LOGS) | Operativa de almacen. |
| Envios | Local (LOGS) → OPS/VIEW | Se expone estado/tracking. |

## 4. Flujo previsto de **peticiones logisticas**

1. MerchanOPS crea una peticion y la envia a MerchanLOGS con:
   `clientId`/`ceco`, `campaignId`/`campaignName`, `serviceId`, `merchanOpsId`,
   `externalId`, `sourceSystem: "merchanops"`.
2. MerchanLOGS la inserta con `syncStatus: "synced"` y `merchanOpsId` mapeado.
3. Almacen la procesa (revision → picking → lista → envio).
4. Cada cambio de estado se marca `syncStatus: "pending"` y se **devuelve** a
   MerchanOPS el estado logistico actualizado; al confirmar, `syncStatus: "synced"`
   y `lastSyncedAt`.

El historico de cambios (`requestHistory`) ya se registra localmente y serviria
de base para el log de sincronizacion.

## 5. Flujo previsto de **incidencias**

1. Una incidencia puede nacer en LOGS (almacen), en MerchanOPS (gestor) o en
   MerchanGO (campo, via `externalId`/`sourceSystem: "merchango"`).
2. Se vincula por id a cliente, campana, servicio, PDV, material, envio, peticion
   o entrada (todos los FK ya existen en la entidad `Incident`).
3. Las incidencias **criticas** (`severity: "critica"`) se marcarian para
   publicarse a **MerchanVIEW** (portal cliente).
4. La resolucion (`status: "resuelta"`, `resolvedAt`, `resolutionNotes`) se
   propaga a los sistemas suscritos.

## 6. Flujo previsto para **ISDIN / Vinilos**

MerchanLOGS ya permite registrar material vinculado a ISDIN con todo lo necesario:

- Cliente/CECO **ISDIN** (`cli_isdin`, con `merchanOpsId`).
- Campana de vinilos (`cmp_isdin_vinilos`).
- Servicio/PDV con `pointOfSaleType: "farmacia"`, `province`, `installationWeek`.
- Material vinilo con `heightCm` / `widthCm` (medidas a medida) y estado
  (`pendiente_produccion`, `recibido`, `preparado`, `enviado`).
- Incidencias de tipo `medidas_incorrectas` / `material_no_encaja` /
  `material_faltante` que enlazan servicio + material + PDV.

Cuando se integre, MerchanOPS podra enviar una peticion o incidencia de ISDIN
usando `clientId`, `ceco`, `campaignId`, `campaignName`, `serviceId`,
`merchanOpsId`, `externalId` y `sourceSystem` — todos ya modelados.

## 7. Estrategia de sincronizacion recomendada

- **Base comun en Supabase**: nombres de coleccion (`CollectionName`) mapean 1:1
  a tablas. Los tipos son serializables (estados como texto).
- **Deltas incrementales** por `updatedAt` + `syncStatus`.
- **Resolucion de conflictos**: `syncStatus: "conflict"` cuando ambos lados
  cambian entre sincronizaciones; politica "ultima escritura gana" por defecto,
  revisable por administracion.
- **Idempotencia**: usar `merchanOpsId`/`externalId` como claves de deduplicacion.

## 8. Riesgos identificados

- **Doble maestro**: definir claramente que sistema es la fuente de verdad de
  cada entidad (ver tabla seccion 3) para evitar sobrescrituras.
- **Identidad de usuarios**: los gestores deben resolverse por el mismo id que
  MerchanOPS (Supabase Auth) para que los permisos y la autoria cuadren.
- **Consistencia de stock**: el stock es responsabilidad de LOGS; MerchanOPS no
  debe escribirlo, solo consultarlo, para no romper el cuadre stock↔movimientos.
- **Enumeraciones divergentes**: mantener sincronizados los catalogos de estados
  entre ambos proyectos (idealmente un paquete compartido en el futuro).
- `strict: false` puede ocultar errores de `null` en el mapeo; conviene endurecer
  tipos en el adaptador Supabase.

## 9. Que NO esta sincronizado todavia

- No hay conexion a Supabase (cliente preparado pero inactivo).
- No hay autenticacion real.
- No se intercambia nada con MerchanOPS, MerchanGO ni MerchanVIEW.
- No hay integracion con transportistas (Nacex u otros).

---

## Actualizacion fase 2: nuevas entidades y su sincronizacion

Nuevas colecciones (mapeo 1:1 a tablas Supabase), todas con campos de sync:

| Entidad | Direccion prevista | Notas |
|---------|--------------------|-------|
| `materialItems` (piezas VIN) | Local (LOGS), origen import/MerchanOPS | `itemCode` unico; clave de deduplicacion. |
| `pickingBatches` | Local (LOGS) → OPS (estado) | Se expone estado/cierre a OPS. |
| `importBatches` | Local (LOGS) | Documento de importacion; trazabilidad. |

- Las incidencias añaden `pickingBatchId`, `pickingLineId`, `materialItemId`,
  `importBatchId` y `blocksPicking` (todos preparados para sincronizar).
- La solicitud OPS simulada ya fija `sourceSystem="merchanops"`,
  `merchanOpsId`, `externalId`, `syncStatus="pending"` — exactamente el contrato
  que usaria una peticion real entrante.
- El cierre de picking y la creacion de envio son los puntos donde LOGS
  **devolveria** el estado logistico a OPS (marcando `syncStatus="pending"`).
