-- =====================================================================
--  Technology Sales · Módulos internos (Supabase / Postgres)
--  Seguridad: PUENTE CON FIREBASE (RLS real por usuario interno).
--  Ejecuta este script en: Supabase → SQL Editor → New query → Run
--  Es idempotente: puedes correrlo varias veces sin problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Allowlist de usuarios internos (admin / asesor / vendedor)
--    Solo los correos aquí podrán leer/escribir los módulos internos.
--    Ajusta estos correos a los reales de tu equipo.
-- ---------------------------------------------------------------------
create table if not exists public.internos (
  email   text primary key,
  nombre  text,
  rol     text                                  -- 'admin' | 'asesor' | 'vendedor'
);

insert into public.internos (email, nombre, rol) values
  ('avid@ts.com',     'David',  'admin'),
  ('avid0316@ts.com', 'David',  'admin'),
  ('miguel@ts.com',   'Miguel', 'admin'),
  ('wilmer@ts.com',   'Wilmer', 'asesor'),
  ('ventas@ts.com',   'Ventas', 'vendedor')
on conflict (email) do nothing;

-- Helper: ¿el usuario autenticado (token de Firebase) es interno?
create or replace function public.is_interno() returns boolean
language sql stable as $$
  select exists (
    select 1 from public.internos
    where email = (auth.jwt() ->> 'email')
  );
$$;

-- ---------------------------------------------------------------------
-- 1) Equipos tomados en cambio o comprados localmente
--    Una sola tabla con dos flujos (tipo = 'cambio' | 'compra').
-- ---------------------------------------------------------------------
create table if not exists public.equipos_registro (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null default 'cambio',   -- 'cambio' | 'compra'
  categoria       text,                             -- telefono|computadora|tablet|reloj|consola|audifonos|otros
  fecha           date,
  sucursal        text,
  dispositivo     text,                             -- marca / modelo / capacidad
  -- comunes
  costo           numeric,                          -- valoración (cambio) o precio de compra (compra)
  notas           text,                             -- observaciones
  foto_imei       text,                             -- URL foto del IMEI / serial
  fotos           text[] default '{}',              -- URLs fotos del dispositivo / lo comprado
  -- cambio
  vendedor_entrega text,
  condicion       text,                             -- estado físico
  foto_garantia   text,                             -- URL foto de la garantía
  -- compra
  solicita        text,
  proveedor       text,
  forma_pago      text,
  estado_compra   text default 'Pendiente',         -- 'Pendiente' | 'Ingresado al sistema' | 'Revisado'
  -- auditoría
  recibido_por    text,
  recibido_email  text,
  creado_en       timestamptz not null default now()
);

-- Columnas nuevas para instalaciones que ya tenían la tabla anterior:
alter table public.equipos_registro add column if not exists categoria        text;
alter table public.equipos_registro add column if not exists fecha            date;
alter table public.equipos_registro add column if not exists dispositivo      text;
alter table public.equipos_registro add column if not exists foto_imei        text;
alter table public.equipos_registro add column if not exists fotos            text[] default '{}';
alter table public.equipos_registro add column if not exists vendedor_entrega text;
alter table public.equipos_registro add column if not exists foto_garantia    text;
alter table public.equipos_registro add column if not exists solicita         text;
alter table public.equipos_registro add column if not exists proveedor        text;
alter table public.equipos_registro add column if not exists forma_pago       text;
alter table public.equipos_registro add column if not exists estado_compra    text default 'Pendiente';
alter table public.traslados        add column if not exists categoria        text;

-- ---------------------------------------------------------------------
-- 2) Solicitudes de traslado de equipos entre sucursales
--    Flujo: Solicitado -> Aprobado -> En tránsito -> Recibido (o Rechazado)
-- ---------------------------------------------------------------------
create table if not exists public.traslados (
  id                 uuid primary key default gen_random_uuid(),
  equipo             text not null,
  categoria          text,
  marca              text,
  modelo             text,
  capacidad          text,
  imei               text,
  origen             text not null,
  destino            text not null,
  estado             text not null default 'Solicitado',
  motivo             text,
  solicitante        text,
  solicitante_email  text,
  aprobado_por       text,
  recibido_por       text,
  img_envio          text[] default '{}',
  img_recibo         text[] default '{}',
  historial          jsonb  default '[]',
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) Tareas asignables a usuarios internos
-- ---------------------------------------------------------------------
create table if not exists public.tareas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descripcion     text,
  asignado_a      text,
  asignado_email  text,
  creado_por      text,
  creado_email    text,
  prioridad       text default 'media',
  estado          text default 'pendiente',
  fecha_limite    date,
  creado_en       timestamptz not null default now(),
  completado_en   timestamptz
);

-- =====================================================================
--  Seguridad (RLS) — solo usuarios internos (validado por el CORREO del
--  token de Firebase, vía is_interno()). No depende del rol 'authenticated',
--  así no hace falta desplegar Blocking Functions de Firebase.
-- =====================================================================
alter table public.internos          enable row level security;
alter table public.equipos_registro  enable row level security;
alter table public.traslados         enable row level security;
alter table public.tareas            enable row level security;

drop policy if exists "read internos" on public.internos;
create policy "read internos" on public.internos
  for select using (public.is_interno());

drop policy if exists "rw equipos"   on public.equipos_registro;
drop policy if exists "rw traslados" on public.traslados;
drop policy if exists "rw tareas"    on public.tareas;

create policy "rw equipos"   on public.equipos_registro for all
  using (public.is_interno()) with check (public.is_interno());
create policy "rw traslados" on public.traslados        for all
  using (public.is_interno()) with check (public.is_interno());
create policy "rw tareas"    on public.tareas           for all
  using (public.is_interno()) with check (public.is_interno());

-- =====================================================================
--  Storage: buckets para imágenes (traslados y equipos)
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('traslados', 'traslados', true),
  ('equipos',   'equipos',   true)
on conflict (id) do nothing;

drop policy if exists "read internos storage"  on storage.objects;
drop policy if exists "write internos storage" on storage.objects;
drop policy if exists "read traslados storage"  on storage.objects;  -- limpia versión anterior
drop policy if exists "write traslados storage" on storage.objects;

-- Lectura pública de ambos buckets (las URLs se muestran en la app)
create policy "read internos storage" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('traslados','equipos'));

-- Subir/editar/borrar solo internos (validado por correo del token)
create policy "write internos storage" on storage.objects
  for all
  using (bucket_id in ('traslados','equipos') and public.is_interno())
  with check (bucket_id in ('traslados','equipos') and public.is_interno());
