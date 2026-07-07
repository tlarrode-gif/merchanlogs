# MerchanLOGS

Aplicación logística independiente sincronizada con MerchanOPS.

MerchanLOGS gestiona:

- almacén e inventario;
- stock físico, reservado, picking y bloqueado;
- solicitudes logísticas recibidas desde MerchanOPS;
- picking, envíos, incidencias y pendientes de llegada;
- eventos de integración y logs de sincronización.

## Configuración

Variables esperadas:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MERCHANOPS_URL=
```

Si Supabase no está configurado, la app usa fallback local en `localStorage` bajo la clave `merchanlogs_logistics_v1`.

## Compatibilidad MerchanOPS

La app reutiliza los contratos logísticos de MerchanOPS y mantiene compatibilidad con:

- `logistics_materials`
- `logistics_stock`
- `logistics_stock_movements`
- `logistics_entries`
- `logistics_entry_lines`
- `logistics_material_requirements`
- `logistics_requests`
- `logistics_request_lines`
- `logistics_pickings`
- `logistics_picking_lines`
- `logistics_shipments`
- `logistics_incidents`
- `logistics_pending_arrivals`
- `logistics_vins`
- `integration_events`
- `sync_logs`

También mantiene escritura espejo hacia MerchanOPS cuando corresponde:

- `services.logistics_status`
- `services.logistics_request_id`
- `services.logistics_last_sync_at`
- `services.logistics_sync_event_id`
- `services.material_status`
- `services.tracking`
- `points.logistics_status`
- `isdin_vinyls.logistics_status`

## Desarrollo

```bash
pnpm install
pnpm build
```

El primer objetivo funcional incluye Dashboard, Inventario, Solicitudes y Sincronización. El resto de módulos queda estructurado para iterar sin cambiar la navegación principal.
