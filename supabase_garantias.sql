-- =====================================================================
-- Technology Sales · Reglas de garantía editables (Fase 1)
-- Ejecutar en Supabase (SQL Editor) del proyecto correspondiente.
-- Requiere que ya exista la función public.is_admin().
-- Es idempotente: se puede volver a correr sin romper nada.
-- =====================================================================

begin;

create table if not exists public.garantias_reglas (
  id             bigint generated always as identity primary key,
  nombre         text    not null default '',
  marca          text    not null default '',   -- '' = cualquier marca
  claves         text    not null default '',   -- palabras clave del modelo, separadas por coma. '' = todas
  estado         text    not null default '',   -- '' = todos | 'Nuevo' | 'Usado'
  dias_tienda    integer not null default 0,
  dias_fabrica   integer not null default 0,    -- se suma solo en nuevos. 365 = "1 año"
  orden          integer not null default 100,  -- menor = se evalúa primero
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now()
);

alter table public.garantias_reglas enable row level security;

grant select on public.garantias_reglas to anon, authenticated;
grant insert, update, delete on public.garantias_reglas to authenticated;

-- Lectura pública: el catálogo muestra los días de garantía a cualquiera.
drop policy if exists "garantias read" on public.garantias_reglas;
create policy "garantias read" on public.garantias_reglas
  for select using (true);

-- Escritura sólo para administración (is_admin()).
drop policy if exists "garantias write" on public.garantias_reglas;
create policy "garantias write" on public.garantias_reglas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Reglas de ejemplo (solo se cargan si la tabla está vacía). Editalas
-- desde el panel "Garantías" de la web cuando quieras.
insert into public.garantias_reglas (nombre, marca, claves, estado, dias_tienda, dias_fabrica, orden)
select * from (values
  ('iPhone 16/17 nuevos',     'Apple',   'iPhone 16, iPhone 17', 'Nuevo', 150, 365, 10),
  ('iPhone 16/17 usados',     'Apple',   'iPhone 16, iPhone 17', 'Usado', 150,   0, 11),
  ('iPhone 13/14/15 usados',  'Apple',   'iPhone 13, iPhone 14, iPhone 15', 'Usado', 90, 0, 20),
  ('iPhone 11/12 usados',     'Apple',   'iPhone 11, iPhone 12', 'Usado',  60,   0, 21),
  ('Apple nuevos (resto)',    'Apple',   '',                     'Nuevo',  90, 365, 40),
  ('Samsung S21 usados',      'Samsung', 'S21',                  'Usado',  60,   0, 30),
  ('Samsung nuevos',          'Samsung', '',                     'Nuevo',  90, 365, 41)
) as v(nombre, marca, claves, estado, dias_tienda, dias_fabrica, orden)
where not exists (select 1 from public.garantias_reglas);

commit;
