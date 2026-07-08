# Carga masiva (copiar/pegar desde Excel)

Ruta: **`/importaciones`** · Permiso: `imports.view` (ver), `imports.manage` (confirmar).

En esta fase la importacion es por **copiar/pegar** (texto tab-separado, TSV), no
por archivo `.xlsx`/`.csv`. El flujo tiene previsualizacion y validacion antes de
crear nada.

## Flujo

1. Selecciona **tipo de importacion**: ISDIN / Vinilos, Banc Sabadell / Visuales,
   o Material generico.
2. Selecciona **cliente/CECO** (obligatorio) y **campana** (opcional).
3. **Pega** las filas copiadas desde Excel (se separan por tabuladores). La
   cabecera es opcional (se detecta automaticamente).
4. Pulsa **Previsualizar y validar**: se muestran filas validas, duplicadas y con
   error, con el detalle de cada error.
5. Pulsa **Confirmar importacion**. Solo se procesan las filas validas.

## Consecuencias al confirmar

- Se crea un **`ImportBatch`** (documento de la importacion) con el recuento.
- **ISDIN / Banc Sabadell** → se crean **piezas unitarias** (`MaterialItem`) en
  estado `recibido`, y un **movimiento de stock `entrada`** por pieza.
- **Generico** → se crea/actualiza un **material agregado** y una **entrada de
  stock** recibida (que suma stock y genera su movimiento).
- Cada entidad creada queda enlazada al `ImportBatch` (`importBatchId`) para
  trazabilidad.

## Plantilla ISDIN / Vinilos

Columnas (en este orden):

```
vinCode  clientName  ceco  campaignName  pharmacyName  pointOfSaleName  address
city  province  postalCode  week  height  width  quantity  installer  serviceCode  notes
```

Reglas:

- `vinCode` **obligatorio** y con formato **`VIN-XXXXX`** (ej. `VIN-31195`).
- `vinCode` representa una **pieza unica**: si se repite (en el pegado o contra lo
  ya existente) se marca **duplicado** y **no se importa**.
- `quantity` vacio ⇒ 1 (cada VIN es una pieza).
- `height`/`width` deben ser numericos si vienen informados.
- `clientName` y `campaignName` obligatorios.
- Se conserva el detalle de cada fila importada en el `ImportBatch`.

Ejemplo (pega tal cual, con tabuladores):

```
VIN-31195	ISDIN	CECO-ISDIN-01	ISDIN Vinilos Farmacias 2026	Farmacia Diagonal	Farmacia Diagonal	Av. Diagonal 400	Barcelona	Barcelona	08008	2026-W29	120	200	1	Instalador BCN 1	SRV-ISDIN-0001	
```

## Plantilla Banc Sabadell / Visuales por oficina

Columnas (en este orden):

```
officeCode  officeName  clientName  ceco  campaignName  address  city  province
postalCode  installer  visualCode  materialType  materialName  height  width
quantity  route  wave  notes
```

Reglas:

- `officeCode` u `officeName` obligatorio; `materialName`, `clientName`,
  `campaignName` obligatorios.
- `quantity` puede ser >1 ⇒ se crean **N piezas** para esa oficina/material.
- `height`/`width`/`quantity` numericos si vienen informados.
- Duplicado "razonable" = misma combinacion `officeCode | visualCode |
  materialName` dentro del pegado (se marca como advertencia).
- Se conserva el detalle por oficina y por material.
- Preparado para **agrupar despues por instalador** (no se convierte cada linea
  en un picking independiente).

## Validaciones y duplicados (resumen)

- **ISDIN**: duplicado de `vinCode` = **error** (pieza unica). No se importa.
- **Banc Sabadell**: duplicado = **advertencia**; se importa igualmente.
- Campos obligatorios y numericos se validan antes de confirmar.
- Las filas con error se conservan en el `ImportBatch` pero **no** crean entidades.

## Limitaciones actuales

- Solo copiar/pegar (TSV). No hay lectura de ficheros todavia.
- La deteccion de columnas asume el orden de la plantilla (o cabecera con los
  nombres exactos de columna).
- El detalle crudo de cada fila se guarda en el `ImportBatch` (`rows`).
