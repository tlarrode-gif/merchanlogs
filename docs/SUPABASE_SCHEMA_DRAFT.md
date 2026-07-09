# Borrador de esquema Supabase — MerchanLOGS

> **BORRADOR. No aplicado, no hay conexion activa.** Este SQL es una referencia
> de como se trasladaria el modelo local a Postgres/Supabase. Los estados se
> modelan como `text` con `CHECK` (o enums nativos, opcional). Cada tabla incluye
> las columnas de sincronizacion comunes.

## Columnas de sincronizacion comunes (en todas las tablas)

```sql
id            text primary key,
external_id   text,
merchan_ops_id text,
source_system text not null default 'merchanlogs',
sync_status   text not null default 'local',
last_synced_at timestamptz,
created_at    timestamptz not null default now(),
updated_at    timestamptz not null default now(),
created_by    text,
updated_by    text
```

## DDL de referencia

```sql
-- Usuarios (los gestores se resolveran contra Supabase Auth / MerchanOPS)
create table users (
  id text primary key,
  username text not null,
  display_name text not null,
  email text,
  role text not null check (role in ('administracion','gestor','almacen')),
  active boolean not null default true,
  provinces text[] not null default '{}',
  external_id text, merchan_ops_id text,
  source_system text not null default 'merchanlogs',
  sync_status text not null default 'local',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

create table clients (
  id text primary key,
  name text not null,
  ceco text not null,
  description text,
  active boolean not null default true,
  external_id text, merchan_ops_id text, source_system text not null default 'merchanlogs',
  sync_status text not null default 'local', last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

create table campaigns (
  id text primary key,
  client_id text not null references clients(id),
  ceco text,
  campaign_name text not null,
  description text,
  start_date timestamptz, end_date timestamptz,
  status text not null check (status in ('borrador','planificada','activa','pausada','finalizada','cancelada')),
  external_id text, merchan_ops_id text, source_system text not null default 'merchanlogs',
  sync_status text not null default 'local', last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

create table services (
  id text primary key,
  client_id text not null references clients(id),
  campaign_id text references campaigns(id),
  service_name text not null, service_code text not null,
  point_of_sale_name text,
  point_of_sale_type text check (point_of_sale_type in ('farmacia','supermercado','oficina_bancaria','tienda','generico')),
  address text, city text, province text, postal_code text,
  scheduled_date timestamptz, installation_week text,
  logistics_status text not null check (logistics_status in ('pendiente','en_preparacion','material_listo','enviado','instalado','incidencia')),
  materials_required text[] not null default '{}',
  notes text,
  external_id text, merchan_ops_id text, source_system text not null default 'merchanlogs',
  sync_status text not null default 'local', last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

create table materials (
  id text primary key,
  client_id text not null references clients(id),
  campaign_id text references campaigns(id),
  name text not null, material_code text not null,
  type text not null check (type in ('vinilo','plv','display','carteleria','muestra','promocional','generico','otro')),
  description text, dimensions text, height_cm numeric, width_cm numeric,
  unit text not null default 'ud',
  current_stock numeric not null default 0,
  minimum_stock numeric not null default 0,
  location text,
  status text not null check (status in ('pendiente_produccion','pendiente_recepcion','recibido','preparado','enviado','agotado','activo')),
  external_id text, merchan_ops_id text, source_system text not null default 'merchanlogs',
  sync_status text not null default 'local', last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

create table stock_entries (
  id text primary key,
  client_id text not null references clients(id),
  campaign_id text references campaigns(id),
  material_id text not null references materials(id),
  quantity numeric not null,
  entry_date timestamptz not null,
  supplier text, delivery_note text, received_by text,
  status text not null check (status in ('pendiente_revision','recibida','parcialmente_recibida','rechazada','incidencia')),
  notes text,
  external_id text, merchan_ops_id text, source_system text not null default 'merchanlogs',
  sync_status text not null default 'local', last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

create table stock_movements (
  id text primary key,
  material_id text not null references materials(id),
  client_id text references clients(id),
  campaign_id text references campaigns(id),
  type text not null check (type in ('entrada','salida','ajuste','reserva','devolucion','incidencia','preparacion','envio')),
  quantity numeric not null,
  from_location text, to_location text, reason text,
  related_entity_type text, related_entity_id text,
  external_id text, merchan_ops_id text, source_system text not null default 'merchanlogs',
  sync_status text not null default 'local', last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

create table logistics_requests (
  id text primary key,
  request_code text not null unique,
  client_id text not null references clients(id),
  campaign_id text references campaigns(id),
  service_id text references services(id),
  requested_by text, assigned_to text,
  priority text not null check (priority in ('baja','normal','alta','urgente')),
  status text not null check (status in ('borrador','solicitada','en_revision','preparando','pendiente_material','lista_para_envio','enviada','entregada','incidencia','cancelada')),
  requested_date timestamptz not null, needed_by_date timestamptz,
  destination text, notes text,
  external_id text, merchan_ops_id text, source_system text not null default 'merchanlogs',
  sync_status text not null default 'local', last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

-- Lineas de material de la peticion (normalizadas en Postgres)
create table logistics_request_lines (
  id bigserial primary key,
  request_id text not null references logistics_requests(id) on delete cascade,
  material_id text not null references materials(id),
  quantity numeric not null,
  prepared_quantity numeric not null default 0,
  notes text
);

create table request_history (
  id text primary key,
  request_id text not null references logistics_requests(id) on delete cascade,
  from_status text, to_status text not null, note text,
  source_system text not null default 'merchanlogs',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

create table shipments (
  id text primary key,
  shipment_code text not null unique,
  logistics_request_id text references logistics_requests(id),
  client_id text references clients(id),
  campaign_id text references campaigns(id),
  carrier text, tracking_number text,
  shipping_date timestamptz, estimated_delivery_date timestamptz, delivery_date timestamptz,
  status text not null check (status in ('pendiente','preparado','enviado','en_transito','entregado','incidencia','devuelto','cancelado')),
  destination text, notes text,
  external_id text, merchan_ops_id text, source_system text not null default 'merchanlogs',
  sync_status text not null default 'local', last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);

create table incidents (
  id text primary key,
  incident_code text not null unique,
  title text not null, description text,
  client_id text references clients(id),
  campaign_id text references campaigns(id),
  service_id text references services(id),
  point_of_sale_name text,
  material_id text references materials(id),
  shipment_id text references shipments(id),
  logistics_request_id text references logistics_requests(id),
  stock_entry_id text references stock_entries(id),
  type text not null check (type in ('material_faltante','material_incorrecto','medidas_incorrectas','material_no_encaja','rotura','retraso_envio','error_picking','error_stock','incidencia_proveedor','incidencia_transporte','otra')),
  severity text not null check (severity in ('baja','media','alta','critica')),
  status text not null check (status in ('abierta','en_revision','en_curso','bloqueada','resuelta','cancelada')),
  assigned_to text, resolved_at timestamptz, resolution_notes text,
  external_id text, merchan_ops_id text, source_system text not null default 'merchanlogs',
  sync_status text not null default 'local', last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by text, updated_by text
);
```

## Notas de implementacion

- **camelCase ↔ snake_case**: el `SupabaseAdapter` debera mapear (los tipos TS
  usan camelCase; Postgres usa snake_case). Alternativa: vistas o columnas
  camelCase entrecomilladas.
- **Lineas de peticion**: en local se guardan embebidas en `materials[]`; en
  Postgres se normalizan en `logistics_request_lines`.
- **RLS (Row Level Security)**: aplicar politicas por rol/provincia al activar
  Supabase Auth compartido con MerchanOPS.
- **Secuencias**: `request_code`/`shipment_code`/`incident_code` deberian
  generarse con secuencias o triggers en vez de en cliente.
- **Indices sugeridos**: `client_id`, `campaign_id`, `status`, `updated_at`
  (para deltas de sincronizacion) y `merchan_ops_id` (deduplicacion).
