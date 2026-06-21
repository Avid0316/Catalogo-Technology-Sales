-- =====================================================================
-- Technology Sales · solo administradores modifican equipos en cambio
-- Ejecutar en staging y, después de validarlo, en producción.
-- Asesor y vendedor conservan lectura y creación de registros.
-- =====================================================================

begin;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.internos
    where lower(email) = lower(auth.jwt() ->> 'email')
      and lower(coalesce(rol, '')) = 'admin'
  );
$$;

alter table public.equipos_registro enable row level security;

drop policy if exists "rw equipos" on public.equipos_registro;
drop policy if exists "read equipos" on public.equipos_registro;
drop policy if exists "create equipos" on public.equipos_registro;
drop policy if exists "admin update equipos" on public.equipos_registro;
drop policy if exists "admin delete equipos" on public.equipos_registro;

create policy "read equipos" on public.equipos_registro
  for select using (public.is_interno());

create policy "create equipos" on public.equipos_registro
  for insert with check (public.is_interno());

create policy "admin update equipos" on public.equipos_registro
  for update using (public.is_admin()) with check (public.is_admin());

create policy "admin delete equipos" on public.equipos_registro
  for delete using (public.is_admin());

commit;
