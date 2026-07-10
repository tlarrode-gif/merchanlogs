# Reconciliación de modelos — MerchanLOGS ↔ Supabase (proyecto MerchanOPS)

Fecha: 2026-07-09 · Proyecto Supabase: `MerchanOPS` (dptmswhwmqimijpfyndn)

## Decisión de arquitectura (confirmada)

MerchanLOGS **comparte el proyecto Supabase de MerchanOPS** y actúa como
**co-propietario de escritura** de las tablas `logistics_*`. No se crea un
esquema nuevo: el backend logístico **ya existe en producción** (creado por el
módulo de logística de MerchanOPS) y este documento mapea cada colección de
LOGS a su tabla real. `docs/SUPABASE_SCHEMA_DRAFT.md` queda **obsoleto** como
esquema a crear; se conserva solo como referencia histórica.

Despliegue gradual: fase 3a = solo lectura (completada), **fase 3b =
escritura en tablas `logistics_*`** (este commit), fase 3c = Supabase Auth +
RLS (obligatorio antes de producción, ver `docs/SECURITY_AUDIT.md`).

## Fase 3b — reglas de escritura (implementadas)

- **Maestros de OPS bloqueados**: `clients`, `grandes_campanas`, `services` y
  `app_users` lanzan error ante cualquier `insert`/`update`/`remove`.
- **Solo vocabulario admitido**: las tablas compartidas tienen CHECK
  constraints; los mapas inversos (dominio → DB) emiten únicamente valores
  admitidos, verificados contra `pg_constraint` del proyecto real
  (2026-07-10) y protegidos por test (`tests/supabase-adapter.test.ts`).
  Estados de LOGS sin equivalente exacto se traducen al valor más cercano
  (ej. picking `cancelado` → `cerrado`; línea `cancelada` → `faltante` con
  justificación).
- **IDs del DB**: al insertar se descarta el id local, el DB genera el uuid
  (`uuid_generate_v4()`) y el adapter devuelve la entidad releída.
- **Columnas uuid protegidas**: las referencias estrictas (`material_id`,
  `picking_id`, `request_id`, `envio_id`…) solo reciben uuids reales
  (`uuidOrNull`/`requireUuid`); jamás ids locales ni texto libre.
- **No se toca `activo` de materiales** desde LOGS (desactivar un material
  afectaría a OPS); el estado "agotado" se deriva del stock en lectura.
- **Movimientos de stock inmutables**: solo `insert` (trazabilidad).
- **Entradas**: LOGS modela 1 entrada = 1 material; al escribir se crea
  cabecera + línea y el id de dominio sigue siendo el id de línea. El borrado
  elimina solo la línea (la cabecera puede tener líneas de OPS).
- **Integridad de stock garantizada por el DB**: el CHECK de
  `logistics_stock` impide físico/reservado negativos o sobre-reserva, como
  segunda barrera además de la validación del dominio.
- `reset()` sigue BLOQUEADO para siempre.

### Espejo de retorno hacia OPS (`services/ops-mirror.ts`)

Excepción acotada y pactada a la regla "LOGS no escribe maestros": cuando LOGS
cambia el estado de una petición, crea un picking o un envío, actualiza
**solo columnas de lista blanca** para que OPS lo vea al instante:

- `logistics_material_requirements`: `status`, `picking_id`, `shipment_id`,
  `updated_at` (jamás reabre necesidades `consumida`/`cancelada`).
- `services`: `logistics_status`, `material_status`, `logistics_last_sync_at`.
- `isdin_vinyls`: `logistics_status`, `logistics_picking_id`,
  `logistics_shipment_id`, `logistics_blocked`, `logistics_last_sync_at`.

Las listas blancas y el vocabulario (CHECK de requirements) están fijados por
test en `tests/ops-mirror.test.ts`. El espejo es best-effort: si falla, la
operación principal de LOGS no se rompe y el reverse-sync de OPS lo corrige.
Ver `merchanops/docs/AUDITORIA_COMUNICACION_OPS_LOGS.md`.

## Mapa colección → tabla

| Colección LOGS | Tabla(s) Supabase | Notas |
|---|---|---|
| `clients` | `clients` | Maestro de OPS. LOGS no escribe. |
| `campaigns` | `grandes_campanas` | Maestro de OPS. LOGS no escribe. |
| `services` | `services` | Maestro de OPS. LOGS no escribe. |
| `users` | `app_users` | Maestro de OPS (auth compartida futura). LOGS no escribe. |
| `materials` | `logistics_materials` ⋈ `logistics_stock` | **Join por `material_id`**: el catálogo y el stock viven separados en el DB. |
| `materialItems` | `logistics_vins` | Piezas VIN. `campana_id` es texto libre (ej. "ISDIN"), no FK. |
| `stockMovements` | `logistics_stock_movements` | Tipos con vocabulario distinto (ver tabla de estados). |
| `stockEntries` | `logistics_entries` ⋈ `logistics_entry_lines` | LOGS modela entrada=1 material; el DB entrada+N líneas → **una StockEntry por línea** (id = id de línea). |
| `logisticsRequests` | `logistics_requests` ⋈ `logistics_request_lines` | Las líneas del DB se colapsan en `materials[]`. |
| `pickingBatches` | `logistics_pickings` ⋈ `logistics_picking_lines` | Las líneas del DB se colapsan en `lines[]`. |
| `shipments` | `logistics_shipments` | Directo. |
| `incidents` | `logistics_incidents` | Directo (campos en español). |
| `requestHistory` | — (sin tabla) | Se mantiene **local** (localStorage) en fase 3a; candidata a `logistics_audit_log` en 3b. |
| `importBatches` | — (sin tabla) | Se mantiene **local** en fase 3a. |

## Diferencias estructurales que resuelve el adapter

1. **Idioma/convención**: DB en español snake_case (`cantidad_fisica`),
   dominio en inglés camelCase (`currentStock`). Traducción por mapeadores.
2. **IDs**: DB usa `uuid`; el dominio los trata como strings opacos → sin
   conversión. Los ids con prefijo (`mat_…`) solo se generan en local.
3. **Stock separado**: `Material.currentStock/reservedStock` = join de
   `logistics_stock` (`cantidad_fisica`/`cantidad_reservada`). El DB además
   tiene `cantidad_picking`, `cantidad_bloqueada` y `disponible` (generada).
4. **Embebido vs normalizado**: `PickingBatch.lines`, `Request.materials` y
   las entradas se expanden/colapsan entre arrays del dominio y tablas hijas.
5. **Vocabulario de estados**: ver tabla siguiente. El mapeo es **tolerante**:
   valores desconocidos caen a un estado seguro y se conserva el original en
   los campos de sync (`externalId` lleva el id del DB; `sourceSystem:
   "merchanops"`).

## Mapa de estados (DB → dominio)

| Ámbito | Valor DB (real, observado) | Dominio LOGS |
|---|---|---|
| requests.status | `pendiente_revision` | `en_revision` |
| | `aceptada` / `parcialmente_aceptada` | `preparando` |
| | `rechazada` | `cancelada` |
| | `entregada` | `entregada` |
| | (desconocido) | `solicitada` |
| requests.priority | `critica` | `urgente` |
| entries.estado | `recibido_completo` | `recibida` |
| | `recibido_parcial` | `parcialmente_recibida` |
| | `con_incidencia` | `incidencia` |
| | (desconocido) | `pendiente_revision` |
| movements.tipo | `picking` | `salida_picking` |
| | `entrega` | `envio` |
| | `liberacion` | `liberacion_reserva` |
| | (resto: `entrada`, `salida`, `ajuste`, `reserva`, `devolucion`) | igual |
| vins.estado | `en_almacen` | `recibido` |
| | `entregado` | `enviado` |
| | (desconocido) | `recibido` |
| pickings.estado | `pendiente` / `recibido` | `pendiente_preparacion` |
| | `en_preparacion` | `en_preparacion` |
| | `preparado` / `listo` | `preparado_completo` |
| picking_lines.estado | `listo` | `preparado` |
| shipments.estado | `entregado`, `enviado`, `pendiente`… | igual (mismo vocabulario) |

En **escritura** (fase 3b) se aplicará el mapa inverso; los estados que LOGS
introduce y OPS no conoce (ej. `pendiente_material`) se documentarán con el
equipo de OPS antes de escribirlos.

## Reglas de propiedad (co-ownership)

- **LOGS escribe** (fase 3b): `logistics_materials`, `logistics_stock`,
  `logistics_stock_movements`, `logistics_vins`, `logistics_entries(+lines)`,
  `logistics_pickings(+lines)`, `logistics_shipments`, `logistics_incidents`
  y el estado logístico de `logistics_requests`.
- **LOGS solo lee**: `clients`, `grandes_campanas`, `services`, `app_users`.
- **Nunca**: `reset()` contra Supabase está bloqueado en el adapter (la base
  compartida jamás se re-siembra desde LOGS).

## Cómo activar

```
NEXT_PUBLIC_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=<url del proyecto MerchanOPS>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Sin la variable (o sin claves), la app sigue en datos locales como hasta ahora.
En fase 3a cualquier intento de escritura con Supabase activo lanza un error
explicativo; la UI sigue siendo utilizable para consulta.
