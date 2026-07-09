# Picking agrupado (PickingBatch)

Ruta: **`/picking`** (lista + crear), **`/picking/[id]`** (detalle),
**`/picking/[id]/print`** (hoja imprimible). Permiso: `picking.view` / `picking.manage`.

## Concepto

Un **`PickingBatch`** agrupa lineas de preparacion segun un **criterio**
(`groupingType`). Resuelve el escenario real: un instalador puede recibir cientos
de piezas repartidas en decenas de oficinas/farmacias. En vez de un picking por
linea, se prepara un lote agrupado.

`groupingType`: `por_instalador`, `por_punto_venta`, `por_oficina`,
`por_provincia`, `por_ruta`, `por_tipo_material`, `por_campana`, `manual`.

Para **Banc Sabadell** el criterio principal es **`por_instalador`**.

## Origen del picking

Se puede crear desde:

1. **Piezas / material importado (filtrado)**: elige cliente, campana y filtros
   (instalador, provincia, ruta...). Toma las piezas `recibido` sin picking
   asignado que cumplen el filtro.
2. **Peticion logistica**: toma las lineas de material (agregado) de la peticion.

(Internamente hay helpers para crear desde campana/import; la UI expone los dos
flujos principales.)

## Estados del picking

`borrador` → `pendiente_preparacion` → `en_preparacion` → `preparado_parcial` /
`preparado_completo` → `listo_para_envio` → `enviado` → `cerrado`. Ademas
`bloqueado`, `con_incidencia`, `cancelado`. Las transiciones validas viven en
`lib/status.ts` (`pickingBatchStatusMeta`).

El estado se **deriva** del estado de las lineas al preparar/incidenciar, y se
puede forzar manualmente (transiciones validadas).

## Lineas

Cada linea (`PickingLine`) referencia un **material agregado** (`materialId`, con
cantidad) o una **pieza unitaria** (`materialItemId`, cantidad 1), con su destino
(oficina/farmacia, direccion, provincia, instalador, ruta), medidas, ubicacion y
estado (`pendiente`, `preparado`, `parcial`, `faltante`, `incidencia`).

## Regla de stock (CRITICA)

- **Crear picking**: **reserva** stock (`reservedStock += cantidad`, movimiento
  `reserva`) para material agregado, y marca las piezas unitarias como
  `reservado`. **No** descuenta stock fisico.
- **Preparar linea**: marca `preparedQuantity`/estado. **No** descuenta stock.
- **Incidencia/faltante**: marca la linea; si la incidencia tiene `blocksPicking`,
  impide el cierre.
- **Cerrar picking**: **descuenta** el stock realmente preparado (movimiento
  `salida_picking`), **libera** la reserva del batch, marca las piezas preparadas
  y deja el batch `listo_para_envio` con `closedAt`. Es **idempotente**
  (no se puede cerrar dos veces).
- **Picking parcial**: solo se descuenta lo preparado; lo no preparado no consume
  stock (las piezas no preparadas se liberan del picking; el material agregado no
  preparado simplemente no se descuenta y la linea queda `parcial`/`faltante`).

Disponible = `currentStock - reservedStock`.

## Cierre y envio

Tras cerrar (`listo_para_envio`), se puede **crear un envio** desde el detalle:
el batch pasa a `enviado` y las piezas preparadas a `enviado`, enlazadas al
`Shipment`.

## Escenario Banc Sabadell (por instalador)

1. Importar (o usar la semilla) piezas de varias oficinas con `installer`.
2. Crear picking: origen *piezas*, agrupacion *por_instalador*, cliente *Banc
   Sabadell*, filtro instalador = *Instalador Cat 1*.
3. Se crea un batch con una linea por pieza de ese instalador (agrupadas por
   instalador en la hoja).
4. Preparar lineas, registrar incidencias si falta material.
5. Cerrar (descuenta stock de lo preparado) y crear envio.

## Escenario ISDIN (piezas VIN unicas)

1. Importar vinilos `VIN-XXXXX` (carga masiva). Duplicados se descartan.
2. Crear picking por instalador/punto de venta.
3. Preparar; marcar una pieza con incidencia (ej. medidas incorrectas).
4. Cerrar parcial: solo se consume lo preparado.
