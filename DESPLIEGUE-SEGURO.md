# Despliegue seguro

No publiques primero `index.html`. El nuevo cliente depende de las vistas y
funciones protegidas de Supabase.

## Orden obligatorio

1. Crea una copia de seguridad de `inventario`, `precios`, `internos`,
   `equipos_registro`, `traslados` y `tareas`.
2. Ejecuta `supabase_schema.sql` en Supabase SQL Editor.
3. Ejecuta `supabase_security_hardening.sql`.
4. Registra los accesos comerciales existentes antes del primer despliegue:

   ```sql
   insert into public.catalogo_accesos (email, rol)
   values
     ('cliente@ejemplo.com', 'cliente'),
     ('reventa@ejemplo.com', 'revendedor'),
     ('mayorista@ejemplo.com', 'mayorista'),
     ('apoyo@ejemplo.com', 'comisionista')
   on conflict (email) do update
   set rol = excluded.rol, activo = true, actualizado_en = now();
   ```

   Después del despliegue, el panel de usuarios mantendrá sincronizadas las
   tablas `catalogo_accesos` e `internos` mediante Apps Script.

5. Verifica desde una sesión anónima:

   - `catalogo_publico` se puede leer.
   - `inventario` y `precios` responden 401/403 o devuelven cero filas.
   - `catalogo_publico` no contiene IMEI, consignación, comprometido,
     batería, ciclos, precio mayorista ni precio de reventa.

6. En Apps Script abre **Configuración del proyecto → Propiedades del script**
   y crea `SUPABASE_SERVICE_KEY` con la clave `service_role`. No la pegues
   dentro de `Inventario.gs`.
7. Publica el Apps Script actualizado como una versión nueva. Su `doGet`
   solo debe devolver estado del servicio.
8. Publica la rama web. El workflow despliega Hosting y `firestore.rules`.
9. Prueba estos perfiles: visitante, cliente, revendedor, mayorista,
   comisionista, vendedor, asesor y administrador.

## Comprobaciones posteriores

- Una cuenta sin documento en `usuarios` entra como `cliente`, nunca como
  `revendedor`.
- Una cotización solo muestra éxito después de recibir un ID de Firestore.
- Un cliente autenticado solo puede leer sus propias cotizaciones.
- Un comisionista ve los tres precios y el IMEI enmascarado, pero no puede
  abrir el panel de cotizaciones ni los módulos internos.
- Asesores y vendedores pueden actualizar cotizaciones; solo administradores
  pueden eliminarlas.
- La sincronización usa `replace_catalog_data` y no deja tablas vacías si una
  inserción falla.

## Pendiente antes de considerar cerrado el endurecimiento

Los buckets `equipos` y `traslados` todavía deben migrarse de públicos a
privados. Antes de cambiar ese ajuste hay que guardar rutas de objeto, generar
URLs firmadas de corta duración y migrar las URLs públicas existentes. No
subas fotografías con IMEI, garantías o documentos hasta completar esa fase.
