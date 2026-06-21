-- =====================================================================
-- Technology Sales · corregir accesos de las cuentas reales de staging
-- Ejecutar únicamente en el proyecto: technology-sales-staging
-- No borra inventario, precios ni historial.
-- =====================================================================

begin;

delete from public.internos
where email in (
  'admin.staging@example.com',
  'asesor.staging@example.com',
  'vendedor.staging@example.com'
);

insert into public.internos (email, nombre, rol) values
  ('admin@prueba.com', 'Admin Pruebas', 'admin'),
  ('asesor@prueba.com', 'Asesor Pruebas', 'asesor'),
  ('vendedor@prueba.com', 'Vendedor Pruebas', 'vendedor')
on conflict (email) do update
set nombre = excluded.nombre,
    rol = excluded.rol;

delete from public.catalogo_accesos
where email in (
  'comisionista.staging@example.com',
  'mayorista.staging@example.com',
  'revendedor.staging@example.com',
  'cliente.staging@example.com'
);

insert into public.catalogo_accesos (email, rol, activo) values
  ('comisionista@prueba.com', 'comisionista', true),
  ('mayorista@prueba.com', 'mayorista', true),
  ('revendedor@prueba.com', 'revendedor', true),
  ('cliente@prueba.com', 'cliente', true)
on conflict (email) do update
set rol = excluded.rol,
    activo = true,
    actualizado_en = now();

commit;

select email, rol
from public.internos
order by rol, email;

select email, rol, activo
from public.catalogo_accesos
order by rol, email;
