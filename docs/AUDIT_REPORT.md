# Informe de auditoria funcional — MerchanLOGS (Fase 2)

Rama: `claude/merchanlogs-mvp-phase-1-mnggha` · Datos locales (sin Supabase/OPS).

## 1. Alcance auditado

Rutas, componentes, formularios, botones, estados, datos locales, servicios,
tipos, roles, permisos, entidades y relaciones, y la logica de stock, entradas,
peticiones, picking, envios e incidencias. Foco: **que cada accion tenga una
consecuencia real** en los datos.

## 2. Hallazgos y correcciones

| # | Hallazgo (fase 1) | Severidad | Correccion (fase 2) |
|---|-------------------|-----------|---------------------|
| 1 | **El stock se descontaba al preparar** (`prepareLine` generaba `preparacion` y restaba stock). Violaba la regla de negocio esperada. | Alta | El stock ahora se descuenta **solo al cerrar el picking** (`salida_picking`). Preparar ya no toca stock. |
| 2 | No existia reserva de stock: no se distinguia comprometido vs disponible. | Media | Nuevo `reservedStock` + `availableStock = currentStock - reservedStock`. Crear picking reserva; cerrar/cancelar libera. |
| 3 | Picking basado en lineas de una sola peticion; no escalaba a miles de piezas por instalador. | Alta | Nueva entidad `PickingBatch` con `groupingType` (por instalador/oficina/provincia/ruta/tipo...). |
| 4 | No habia modelo para piezas unitarias (vinilos VIN). El "stock" era solo agregado. | Alta | Nueva entidad `MaterialItem` (pieza unica). Deteccion de duplicados por `itemCode`. |
| 5 | No habia carga masiva; alta manual pieza a pieza. | Alta | Nueva seccion **Carga masiva** (copiar/pegar Excel) con previsualizacion, validacion y duplicados. |
| 6 | Incidencias no se vinculaban a picking ni bloqueaban nada. | Media | Incidencia enlaza `pickingBatchId`/`pickingLineId`/`materialItemId`/`importBatchId` y puede `blocksPicking` (bloquea el cierre). |
| 7 | No existia flujo de solicitud desde OPS. | Media | Nueva simulacion local (`ops.simulate`) que crea `LogisticsRequest` con `sourceSystem="merchanops"`, `syncStatus="pending"`. |
| 8 | Envio no podia generarse desde picking. | Media | `createShipmentFromPicking` marca el batch `enviado` y las piezas `enviado`. |
| 9 | Entradas ya sumaban stock (correcto), pero sin trazabilidad de piezas. | Baja | Import de piezas genera un movimiento `entrada` por pieza (trazabilidad). |
| 10 | `isBelowMinimum` usaba stock fisico. | Baja | Ahora usa stock **disponible** (descuenta reservado). |

## 3. Acciones que ahora tienen consecuencia real (verificado E2E)

- **Entrada recibida** → suma `currentStock` + movimiento `entrada`.
- **Ajuste de stock** → cambia stock + movimiento `ajuste`.
- **Import confirmado** → crea `ImportBatch` + piezas/materiales + movimientos `entrada`; detecta y descarta duplicados.
- **Crear picking** → reserva stock (`reserva`) / marca piezas `reservado`; NO descuenta.
- **Preparar linea** → marca preparado; NO descuenta stock.
- **Incidencia en linea** → crea incidencia vinculada + marca la linea; puede bloquear el cierre.
- **Cerrar picking** → descuenta stock preparado (`salida_picking`), libera reservas, deja `listo_para_envio`.
- **Crear envio desde picking** → batch `enviado`, piezas `enviado`.
- **Solicitud OPS** → crea peticion con campos de sync; convertible en picking.

Verificacion end-to-end (navegador headless) confirmada para: import ISDIN con
VIN duplicado (queda unico), **regla de stock** (3 → crear 3/res 5 → preparar 3 →
cerrar 0), y picking Banc Sabadell agrupado por instalador (4 lineas, 1 instalador).

## 4. Validaciones que impiden datos invalidos

- Entrada: cliente/CECO, material, fecha y cantidad (>0) obligatorios.
- Import ISDIN: `vinCode` obligatorio y con formato `VIN-XXXXX`; duplicados no se importan.
- Import Sabadell: `officeCode`/`officeName`, `materialName`, cliente y campana obligatorios; numericos validados.
- Peticiones/incidencias/envios: validaciones de campos clave y transiciones de estado.
- Stock: `applyStockDelta` impide dejar stock fisico negativo.

## 5. Preparacion para Supabase / MerchanOPS (revisado)

- Capa `DataAdapter` intacta: las nuevas colecciones (`materialItems`,
  `pickingBatches`, `importBatches`) se listan en `CollectionName` y se mapearan
  1:1 a tablas.
- Todas las entidades nuevas extienden `BaseEntity` (campos de sync).
- La solicitud OPS ya marca `sourceSystem`/`merchanOpsId`/`externalId`/`syncStatus`.

## 6. Pendiente / limitaciones

- Reserva permite reservar por encima del disponible (compromiso); el bloqueo
  real se produce al cerrar (no puede dejar stock negativo). Documentado.
- Persistencia local (localStorage). Sin backend ni auth real.
- Import por copiar/pegar TSV; sin `.xlsx`/`.csv` todavia.
- Falta suite de tests automatizada (verificado con script E2E de humo).

## 7. Recomendaciones para Codex

1. Revisar `services/picking.service.ts::closePickingBatch` (invariante de stock)
   y `services/stock.service.ts` (reserva/consumo/movimientos).
2. Revisar `services/imports.service.ts` (parseo TSV, validacion, duplicados).
3. Verificar que ninguna accion de UI muta datos fuera de la capa `services/`.
4. Revisar las maquinas de estado en `lib/status.ts` (transiciones permitidas).
