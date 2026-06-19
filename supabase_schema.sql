-- =====================================================================
--  Technology Sales · Módulos internos (Supabase / Postgres)
--  Seguridad: PUENTE CON FIREBASE (RLS real por usuario interno).
--  Ejecuta este script en: Supabase → SQL Editor → New query → Run
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
-- 1) Registro de equipos tomados en cambio o comprados localmente
-- ---------------------------------------------------------------------
create table if not exists public.equipos_registro (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null default 'cambio',   -- 'cambio' | 'compra'
  marca           text,
  modelo          text,
  capacidad       text,
  color           text,
  imei            text,
  condicion       text,                             -- estado físico del equipo
  costo           numeric,                          -- valor de cambio / precio de compra
  sucursal        text,
  recibido_por    text,                             -- nombre del usuario interno
  recibido_email  text,
  notas           text,
  creado_en       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) Solicitudes de traslado de equipos entre sucursales
--    Flujo: Solicitado -> Aprobado -> En tránsito -> Recibido (o Rechazado)
-- ---------------------------------------------------------------------
create table if not exists public.traslados (
  id                 uuid primary key default gen_random_uuid(),
  equipo             text not null,                 -- descripción corta del equipo
  marca              text,
  modelo             text,
  capacidad          text,
  imei               text,
  origen             text not null,                 -- sucursal origen
  destino            text not null,                 -- sucursal destino
  estado             text not null default 'Solicitado',
  motivo             text,
  solicitante        text,
  solicitante_email  text,
  aprobado_por       text,
  recibido_por       text,
  img_envio          text[] default '{}',           -- URLs de Storage (lo que se manda)
  img_recibo         text[] default '{}',           -- URLs de Storage (lo que se recibe)
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
  asignado_a      text,                             -- nombre del usuario asignado
  asignado_email  text,                             -- email del usuario asignado
  creado_por      text,
  creado_email    text,
  prioridad       text default 'media',             -- 'baja' | 'media' | 'alta'
  estado          text default 'pendiente',         -- 'pendiente' | 'en_progreso' | 'completada'
  fecha_limite    date,
  creado_en       timestamptz not null default now(),
  completado_en   timestamptz
);

-- =====================================================================
--  Seguridad (RLS) — solo usuarios internos autenticados vía Firebase
-- =====================================================================
alter table public.internos          enable row level security;
alter table public.equipos_registro  enable row level security;
alter table public.traslados         enable row level security;
alter table public.tareas            enable row level security;

-- Cada interno puede ver la lista de internos (para asignar tareas, etc.)
drop policy if exists "read internos" on public.internos;
create policy "read internos" on public.internos
  for select to authenticated using (public.is_interno());

drop policy if exists "rw equipos"   on public.equipos_registro;
drop policy if exists "rw traslados" on public.traslados;
drop policy if exists "rw tareas"    on public.tareas;

create policy "rw equipos"   on public.equipos_registro for all to authenticated
  using (public.is_interno()) with check (public.is_interno());
create policy "rw traslados" on public.traslados        for all to authenticated
  using (public.is_interno()) with check (public.is_interno());
create policy "rw tareas"    on public.tareas           for all to authenticated
  using (public.is_interno()) with check (public.is_interno());

-- =====================================================================
--  Storage: bucket para las imágenes de traslados (envío / recibo)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('traslados', 'traslados', true)
on conflict (id) do nothing;

drop policy if exists "read traslados storage"  on storage.objects;
drop policy if exists "write traslados storage" on storage.objects;

-- Lectura pública del bucket (las URLs se muestran en la app)
create policy "read traslados storage" on storage.objects
  for select to anon, authenticated using (bucket_id = 'traslados');

-- Subir/editar/borrar solo internos autenticados
create policy "write traslados storage" on storage.objects
  for all to authenticated
  using (bucket_id = 'traslados' and public.is_interno())
  with check (bucket_id = 'traslados' and public.is_interno());
