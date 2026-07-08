# Flujo de solicitud desde MerchanOPS (simulacion local)

Ruta: **`/solicitudes-ops`**. Permiso: `ops.simulate` (solo Administracion en esta
fase). **NO conecta con MerchanOPS real**: es una simulacion local para dejar
probado y preparado el flujo.

## Que hace hoy

1. Se crea una **`LogisticsRequest`** con los campos que llegarian de OPS:
   - `sourceSystem = "merchanops"`
   - `merchanOpsId` (id de la peticion en OPS)
   - `externalId`
   - `syncStatus = "pending"`
   - `lastSyncedAt = null`
   - cliente/CECO, campana, servicio, prioridad, fecha necesaria, destino,
     materiales y solicitante.
2. Desde la lista de solicitudes con origen OPS, almacen puede **"Convertir en
   picking"** (crea un `PickingBatch` a partir de la peticion).
3. El picking se prepara y se cierra con las reglas normales (el stock se
   descuenta al cerrar).

## Escenario de prueba

1. Crear solicitud simulada (`sourceSystem = merchanops`, `merchanOpsId`).
2. Convertirla en picking.
3. Preparar materiales.
4. Cerrar picking (descuenta stock).
5. Ver el estado actualizado de la peticion/picking.

## Como se conectara mas adelante

Cuando se active la integracion real (ver `docs/SYNC_PREPARATION.md`):

1. OPS **crea** la peticion en MerchanLOGS via el adaptador Supabase o un webhook
   (mismo modelo `LogisticsRequest`, `sourceSystem = "merchanops"`).
2. MerchanLOGS la marca `syncStatus = "synced"` al confirmarla.
3. Almacen genera el picking, lo prepara y lo cierra.
4. MerchanLOGS **devuelve** a OPS el estado logistico actualizado (peticion,
   picking, envio), marcando `syncStatus = "pending"` hasta confirmar.

## Avisos por email (preparado, no implementado)

El flujo esta pensado para que, mas adelante, la llegada de una solicitud OPS
dispare un **aviso por correo** a almacen, y el cierre/envio dispare un aviso de
vuelta. En esta fase **no** se envia email; solo queda la estructura de datos y
el punto de enganche (creacion de la peticion y cambios de estado) donde se
insertaria la notificacion.

## Que NO esta hecho

- No hay conexion real con MerchanOPS.
- No hay envio de emails.
- No hay sincronizacion bidireccional automatica (los `syncStatus` se fijan
  manualmente en la simulacion).
