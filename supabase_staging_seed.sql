-- =====================================================================
-- Technology Sales · datos FICTICIOS para Supabase STAGING
-- No contiene clientes, IMEI, fotografías ni precios reales.
-- =====================================================================

begin;

truncate table public.inventario restart identity;
truncate table public.precios restart identity;
delete from public.catalogo_accesos;
delete from public.internos;

insert into public.inventario (
  categoria, marca, modelo, capacidad, color, chip, sucursal,
  cantidad, consignacion, comprometido, estado, imagen, individual,
  imei, bateria, ciclos, garantia, vence
) values
  ('Celulares', 'MARCA DEMO', 'TELÉFONO DEMO A', '128 GB', 'Negro', 'Dual SIM',
   'Sucursal Centro', 8, 0, 0, 'Nuevo', '', false, '', null, null, '12 meses', ''),
  ('Celulares', 'MARCA DEMO', 'TELÉFONO DEMO A', '128 GB', 'Azul', 'Dual SIM',
   'Sucursal Norte', 4, 0, 0, 'Nuevo', '', false, '', null, null, '12 meses', ''),
  ('Computadoras', 'MARCA DEMO', 'PORTÁTIL DEMO B', '512 GB', 'Gris', '',
   'Sucursal Centro', 3, 0, 0, 'Nuevo', '', false, '', null, null, '12 meses', ''),
  ('Equipos individuales', 'MARCA DEMO', 'EQUIPO INDIVIDUAL DEMO', '256 GB',
   'Blanco', 'eSIM', 'Sucursal Norte', 1, 0, 0, 'Usado', '', true,
   '000000000001234', 91, 142, '30 días tienda', '');

insert into public.precios (
  marca, modelo, capacidad, chip, estado,
  precio_mayorista, precio_reventa, precio_publico
) values
  ('MARCA DEMO', 'TELÉFONO DEMO A', '128 GB', 'Dual SIM', 'Nuevo',
   10000, 11000, 12500),
  ('MARCA DEMO', 'PORTÁTIL DEMO B', '512 GB', '', 'Nuevo',
   18000, 19500, 22000),
  ('MARCA DEMO', 'EQUIPO INDIVIDUAL DEMO', '256 GB', 'eSIM', 'Usado',
   14000, 15000, 16500);

insert into public.internos (email, nombre, rol) values
  ('admin@prueba.com', 'Admin Pruebas', 'admin'),
  ('asesor@prueba.com', 'Asesor Pruebas', 'asesor'),
  ('vendedor@prueba.com', 'Vendedor Pruebas', 'vendedor')
on conflict (email) do update
set nombre = excluded.nombre, rol = excluded.rol;

insert into public.catalogo_accesos (email, rol, activo) values
  ('comisionista@prueba.com', 'comisionista', true),
  ('mayorista@prueba.com', 'mayorista', true),
  ('revendedor@prueba.com', 'revendedor', true),
  ('cliente@prueba.com', 'cliente', true)
on conflict (email) do update
set rol = excluded.rol, activo = true, actualizado_en = now();

commit;
