-- =====================================================================
-- Technology Sales · contención de datos y sincronización atómica
-- Ejecutar ANTES de desplegar el index.html endurecido.
-- Requiere que ya existan: inventario, precios e internos.
-- =====================================================================

begin;

alter table public.inventario enable row level security;
alter table public.precios enable row level security;

revoke all on public.inventario from anon, authenticated;
revoke all on public.precios from anon, authenticated;

drop policy if exists "public read inventario" on public.inventario;
drop policy if exists "public read precios" on public.precios;
drop policy if exists "anon read inventario" on public.inventario;
drop policy if exists "anon read precios" on public.precios;

-- Los usuarios comerciales autorizados se reflejan aquí.
-- No guardes contraseñas: únicamente correo y nivel de precio.
create table if not exists public.catalogo_accesos (
  email text primary key,
  rol text not null check (rol in ('cliente', 'revendedor', 'mayorista', 'comisionista')),
  activo boolean not null default true,
  actualizado_en timestamptz not null default now()
);

alter table public.catalogo_accesos
  drop constraint if exists catalogo_accesos_rol_check;
alter table public.catalogo_accesos
  add constraint catalogo_accesos_rol_check
  check (rol in ('cliente', 'revendedor', 'mayorista', 'comisionista'));

alter table public.catalogo_accesos enable row level security;
revoke all on public.catalogo_accesos from anon, authenticated;

-- Catálogo público: nunca incluye IMEI, costos internos, consignación,
-- comprometido, batería, ciclos ni precios mayorista/reventa.
create or replace view public.catalogo_publico as
select
  i.id,
  i.categoria,
  i.marca,
  i.modelo,
  i.capacidad,
  i.color,
  i.chip,
  i.sucursal,
  greatest(coalesce(i.cantidad, 0), 0)::integer as cantidad,
  i.estado,
  i.imagen,
  i.individual,
  i.garantia,
  i.vence,
  p.precio_publico
from public.inventario i
left join public.precios p
  on upper(trim(coalesce(p.marca, ''))) = upper(trim(coalesce(i.marca, '')))
 and upper(trim(coalesce(p.modelo, ''))) = upper(trim(coalesce(i.modelo, '')))
 and upper(trim(coalesce(p.capacidad, ''))) = upper(trim(coalesce(i.capacidad, '')))
 and upper(trim(coalesce(p.chip, ''))) = upper(trim(coalesce(i.chip, '')))
 and upper(trim(coalesce(p.estado, ''))) = upper(trim(coalesce(i.estado, '')));

revoke all on public.catalogo_publico from public;
grant select on public.catalogo_publico to anon, authenticated;

create or replace function public.catalogo_por_rol()
returns table (
  id bigint,
  categoria text,
  marca text,
  modelo text,
  capacidad text,
  color text,
  chip text,
  sucursal text,
  cantidad integer,
  estado text,
  imagen text,
  individual boolean,
  garantia text,
  vence text,
  precio numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with acceso as (
    select a.rol
    from public.catalogo_accesos a
    where a.email = lower(auth.jwt() ->> 'email')
      and a.activo
    limit 1
  )
  select
    i.id,
    i.categoria,
    i.marca,
    i.modelo,
    i.capacidad,
    i.color,
    i.chip,
    i.sucursal,
    greatest(coalesce(i.cantidad, 0), 0)::integer,
    i.estado,
    i.imagen,
    i.individual,
    i.garantia,
    i.vence,
    case acceso.rol
      when 'mayorista' then p.precio_mayorista
      when 'revendedor' then p.precio_reventa
      else p.precio_publico
    end
  from acceso
  cross join public.inventario i
  left join public.precios p
    on upper(trim(coalesce(p.marca, ''))) = upper(trim(coalesce(i.marca, '')))
   and upper(trim(coalesce(p.modelo, ''))) = upper(trim(coalesce(i.modelo, '')))
   and upper(trim(coalesce(p.capacidad, ''))) = upper(trim(coalesce(i.capacidad, '')))
   and upper(trim(coalesce(p.chip, ''))) = upper(trim(coalesce(i.chip, '')))
   and upper(trim(coalesce(p.estado, ''))) = upper(trim(coalesce(i.estado, '')));
$$;

revoke all on function public.catalogo_por_rol() from public;
grant execute on function public.catalogo_por_rol() to authenticated;

-- El comisionista consulta los tres precios para apoyar ventas, pero recibe
-- un catálogo limitado: sin consignación, comprometido ni IMEI completo.
create or replace function public.catalogo_comisionista()
returns table (
  id bigint,
  categoria text,
  marca text,
  modelo text,
  capacidad text,
  color text,
  chip text,
  sucursal text,
  cantidad integer,
  estado text,
  imagen text,
  individual boolean,
  imei text,
  bateria integer,
  ciclos integer,
  garantia text,
  vence text,
  precio_mayorista numeric,
  precio_reventa numeric,
  precio_publico numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id::bigint,
    i.categoria::text,
    i.marca::text,
    i.modelo::text,
    i.capacidad::text,
    i.color::text,
    i.chip::text,
    i.sucursal::text,
    greatest(coalesce(i.cantidad, 0), 0)::integer,
    i.estado::text,
    i.imagen::text,
    i.individual::boolean,
    case
      when coalesce(i.individual, false) and coalesce(i.imei, '') <> ''
        then '•••• ' || right(i.imei::text, 4)
      else ''
    end,
    i.bateria::integer,
    i.ciclos::integer,
    i.garantia::text,
    i.vence::text,
    p.precio_mayorista,
    p.precio_reventa,
    p.precio_publico
  from public.inventario i
  left join public.precios p
    on upper(trim(coalesce(p.marca, ''))) = upper(trim(coalesce(i.marca, '')))
   and upper(trim(coalesce(p.modelo, ''))) = upper(trim(coalesce(i.modelo, '')))
   and upper(trim(coalesce(p.capacidad, ''))) = upper(trim(coalesce(i.capacidad, '')))
   and upper(trim(coalesce(p.chip, ''))) = upper(trim(coalesce(i.chip, '')))
   and upper(trim(coalesce(p.estado, ''))) = upper(trim(coalesce(i.estado, '')))
  where exists (
    select 1
    from public.catalogo_accesos a
    where a.email = lower(auth.jwt() ->> 'email')
      and a.rol = 'comisionista'
      and a.activo
  );
$$;

revoke all on function public.catalogo_comisionista() from public;
grant execute on function public.catalogo_comisionista() to authenticated;

create or replace function public.catalogo_interno()
returns setof public.inventario
language sql
stable
security definer
set search_path = public
as $$
  select i.*
  from public.inventario i
  where public.is_interno();
$$;

revoke all on function public.catalogo_interno() from public;
grant execute on function public.catalogo_interno() to authenticated;

create or replace function public.precios_internos()
returns setof public.precios
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.precios p
  where public.is_interno();
$$;

revoke all on function public.precios_internos() from public;
grant execute on function public.precios_internos() to authenticated;

-- Un reemplazo completo ocurre dentro de una sola transacción PostgreSQL.
create or replace function public.replace_catalog_data(
  inventory_rows jsonb,
  price_rows jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  delete from public.inventario where true;

  insert into public.inventario (
    categoria, marca, modelo, capacidad, color, chip, sucursal,
    cantidad, consignacion, comprometido, estado, imagen, individual,
    imei, bateria, ciclos, garantia, vence
  )
  select
    x.categoria, x.marca, x.modelo, x.capacidad, x.color, x.chip, x.sucursal,
    coalesce(x.cantidad, 0), coalesce(x.consignacion, 0),
    coalesce(x.comprometido, 0), x.estado, x.imagen,
    coalesce(x.individual, false), x.imei, x.bateria, x.ciclos,
    x.garantia, x.vence
  from jsonb_to_recordset(coalesce(inventory_rows, '[]'::jsonb)) as x(
    categoria text, marca text, modelo text, capacidad text, color text,
    chip text, sucursal text, cantidad integer, consignacion integer,
    comprometido integer, estado text, imagen text, individual boolean,
    imei text, bateria integer, ciclos integer, garantia text, vence text
  );

  delete from public.precios where true;

  insert into public.precios (
    marca, modelo, capacidad, chip, estado,
    precio_mayorista, precio_reventa, precio_publico
  )
  select
    x.marca, x.modelo, x.capacidad, x.chip, x.estado,
    x.precio_mayorista, x.precio_reventa, x.precio_publico
  from jsonb_to_recordset(coalesce(price_rows, '[]'::jsonb)) as x(
    marca text, modelo text, capacidad text, chip text, estado text,
    precio_mayorista numeric, precio_reventa numeric, precio_publico numeric
  );
end;
$$;

revoke all on function public.replace_catalog_data(jsonb, jsonb) from public;
grant execute on function public.replace_catalog_data(jsonb, jsonb) to service_role;

create or replace function public.replace_prices(price_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  delete from public.precios where true;

  insert into public.precios (
    marca, modelo, capacidad, chip, estado,
    precio_mayorista, precio_reventa, precio_publico
  )
  select
    x.marca, x.modelo, x.capacidad, x.chip, x.estado,
    x.precio_mayorista, x.precio_reventa, x.precio_publico
  from jsonb_to_recordset(coalesce(price_rows, '[]'::jsonb)) as x(
    marca text, modelo text, capacidad text, chip text, estado text,
    precio_mayorista numeric, precio_reventa numeric, precio_publico numeric
  );
end;
$$;

revoke all on function public.replace_prices(jsonb) from public;
grant execute on function public.replace_prices(jsonb) to service_role;

commit;
