# Hojas de picking imprimibles

Ruta: **`/picking/[id]/print`**. Boton **"Imprimir hoja"** desde el detalle del
picking, o **"Imprimir hoja de picking"** en la propia hoja (usa `window.print()`).

## Como funciona

La hoja se genera **segun el `groupingType`** del picking (`groupLines()` en
`services/picking.service.ts`):

- **por_instalador** → agrupa por instalador; dentro, por destino/oficina.
- **por_oficina / por_punto_venta** → agrupa por oficina/farmacia.
- **por_tipo_material** → agrupa por tipo de material.
- **por_provincia / por_ruta** → agrupa por provincia o ruta.

## Contenido

**Cabecera**: codigo de picking, cliente/CECO, campana, tipo de agrupacion,
instalador (si aplica), provincia/ruta/oleada, fecha de creacion, prioridad,
estado, y espacios para *Preparado por* / *Revisado por*.

**Resumen**: total destinos, total lineas, total unidades, incidencias abiertas.

**Detalle** (por grupo, en tabla): destino/oficina, direccion, codigo (servicio/
VIN/oficina), material, medidas, cantidad, ubicacion en almacen, y **casillas
fisicas** para *Preparado*, *Falta material* e *Incidencia*, mas *Observaciones*.

## Impresion

- CSS `@media print` **oculta** la barra lateral, la cabecera de la app y los
  botones de accion (`aside`, `header`, `.no-print`).
- Tabla con bordes claros y `break-inside: avoid` por grupo (evita cortar un
  grupo entre paginas); `thead` se repite en cada pagina.
- No genera PDF real todavia; usa el dialogo de impresion del navegador (permite
  "Guardar como PDF").

## Trabajo en papel → registro en app

Tras usar la hoja en papel, almacen vuelve a la app (`/picking/[id]`) y registra:

- **Preparado** (completo o parcial) por linea.
- **Incidencias**: material faltante, dañado, medidas incorrectas, no localizado,
  sustitucion, observaciones (crea una incidencia vinculada a la linea; puede
  marcarse como bloqueante).
- **Cierre** del picking cuando corresponda (descuenta stock de lo preparado).
