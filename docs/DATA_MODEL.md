# Modelo de datos — MerchanLOGS

Todas las entidades extienden `BaseEntity` (`types/base.ts`): `id`, `externalId`,
`merchanOpsId`, `sourceSystem`, `syncStatus`, `lastSyncedAt`, `createdAt`,
`updatedAt`, `createdBy`, `updatedBy`. Aqui solo se listan los campos propios.

## Entidades y relaciones

```
Client (cliente/CECO)
  └─ Campaign (clientId)
        └─ Service (clientId, campaignId, pointOfSale...)
Material (clientId, campaignId?)
StockEntry (clientId, campaignId?, materialId)      → suma stock al recibir
StockMovement (materialId, clientId?, campaignId?)   → generado por cada cambio de stock
LogisticsRequest (clientId, campaignId?, serviceId?, materials[])
  └─ RequestHistoryEntry (requestId)                 → historico de estados
Shipment (logisticsRequestId?, clientId?, campaignId?)
Incident (clientId?, campaignId?, serviceId?, materialId?, shipmentId?,
          logisticsRequestId?, stockEntryId?, pointOfSaleName?)
User (role, provinces[])
```

Las relaciones se modelan por **id** (FK), preparadas para tablas relacionales.

## Colecciones (→ tablas Supabase)

`CollectionName` en `types/index.ts` mapea 1:1 a tablas:
`users`, `clients`, `campaigns`, `services`, `materials`, `stockEntries`,
`stockMovements`, `logisticsRequests`, `requestHistory`, `shipments`, `incidents`.

## Campos por entidad (resumen)

- **Client**: `name`, `ceco`, `description`, `active`.
- **Campaign**: `clientId`, `ceco`, `campaignName`, `description`, `startDate`,
  `endDate`, `status`.
- **Service**: `clientId`, `campaignId`, `serviceName`, `serviceCode`,
  `pointOfSaleName`, `pointOfSaleType`, `address`, `city`, `province`,
  `postalCode`, `scheduledDate`, `installationWeek`, `logisticsStatus`,
  `materialsRequired[]`, `notes`.
- **Material**: `clientId`, `campaignId`, `name`, `materialCode`, `type`,
  `description`, `dimensions`, `heightCm`, `widthCm`, `unit`, `currentStock`,
  `minimumStock`, `location`, `status`.
- **StockEntry**: `clientId`, `campaignId`, `materialId`, `quantity`, `entryDate`,
  `supplier`, `deliveryNote`, `receivedBy`, `status`, `notes`.
- **StockMovement**: `materialId`, `clientId`, `campaignId`, `type`, `quantity`,
  `fromLocation`, `toLocation`, `reason`, `relatedEntityType`, `relatedEntityId`.
- **LogisticsRequest**: `requestCode`, `clientId`, `campaignId`, `serviceId`,
  `requestedBy`, `assignedTo`, `priority`, `status`, `requestedDate`,
  `neededByDate`, `materials[] {materialId, quantity, preparedQuantity, notes}`,
  `destination`, `notes`.
- **Shipment**: `shipmentCode`, `logisticsRequestId`, `clientId`, `campaignId`,
  `carrier`, `trackingNumber`, `shippingDate`, `estimatedDeliveryDate`,
  `deliveryDate`, `status`, `destination`, `notes`.
- **Incident**: `incidentCode`, `title`, `description`, + FKs opcionales
  (`clientId`, `campaignId`, `serviceId`, `pointOfSaleName`, `materialId`,
  `shipmentId`, `logisticsRequestId`, `stockEntryId`), `type`, `severity`,
  `status`, `assignedTo`, `resolvedAt`, `resolutionNotes`.
- **User**: `username`, `displayName`, `email`, `role`, `active`, `provinces[]`.

## Estados (uniones de literales, `types/enums.ts`)

- **CampaignStatus**: borrador, planificada, activa, pausada, finalizada, cancelada.
- **ServiceLogisticsStatus**: pendiente, en_preparacion, material_listo, enviado, instalado, incidencia.
- **MaterialStatus**: pendiente_produccion, pendiente_recepcion, recibido, preparado, enviado, agotado, activo.
- **StockEntryStatus**: pendiente_revision, recibida, parcialmente_recibida, rechazada, incidencia.
- **StockMovementType**: entrada, salida, ajuste, reserva, devolucion, incidencia, preparacion, envio.
- **LogisticsRequestStatus**: borrador, solicitada, en_revision, preparando, pendiente_material, lista_para_envio, enviada, entregada, incidencia, cancelada.
- **Priority**: baja, normal, alta, urgente.
- **ShipmentStatus**: pendiente, preparado, enviado, en_transito, entregado, incidencia, devuelto, cancelado.
- **IncidentType**: material_faltante, material_incorrecto, medidas_incorrectas, material_no_encaja, rotura, retraso_envio, error_picking, error_stock, incidencia_proveedor, incidencia_transporte, otra.
- **IncidentSeverity**: baja, media, alta, critica.
- **IncidentStatus**: abierta, en_revision, en_curso, bloqueada, resuelta, cancelada.

Las etiquetas legibles, colores y **transiciones permitidas** viven en
`lib/status.ts`, y los servicios las usan para validar cambios de estado.

## Invariante de stock

`currentStock` de un material solo cambia a traves de `applyStockDelta`
(`services/stock.service.ts`), que **siempre** registra un `StockMovement`. Asi
el historico de movimientos cuadra con el stock en todo momento.
