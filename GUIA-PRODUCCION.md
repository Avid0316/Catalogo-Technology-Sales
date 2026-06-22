# Guía de pase a producción (endurecimiento de seguridad)

> ⚠️ **Importante:** NO mergees el PR #62 hasta terminar los pasos 1–4.
> El nuevo `index.html` depende de las funciones de Supabase y del claim de
> Firebase. Si lo publicás antes, el catálogo deja de cargar para todos.

Hacé cada paso **en orden** y no avances si uno falla. Guardá capturas por si hay que revisar.

---

## Paso 0 · Respaldo (5 min)
En Supabase (proyecto **real**) → **Database → Backups**, o exportá a CSV las tablas:
`inventario`, `precios`, `internos`, `equipos_registro`, `traslados`, `tareas`.

Así, si algo sale mal, podemos volver atrás.

---

## Paso 1 · SQL en el Supabase de producción (en este orden)
En **SQL Editor → New query**, pegá y ejecutá **uno por uno**:

1. `supabase_schema.sql`  → tablas, `is_interno()`, `is_admin()`, buckets privados.
2. `supabase_security_hardening.sql`  → cierra el acceso anónimo, crea `catalogo_publico`, las funciones por rol y `catalogo_accesos`.
3. `supabase_admin_only_equipment_changes.sql`  → asesor/vendedor crean equipos; solo admin cambia estado o elimina.

Cada uno debe terminar en **Success**. Si alguno da error, pará y mandame la captura.

> Son idempotentes: si tenés que volver a correrlos, no rompen nada.

---

## Paso 2 · Registrar los correos reales
En **SQL Editor**, ajustá y ejecutá (con los correos REALES de tu gente):

```sql
-- Personal interno (acceso completo). rol: 'admin' | 'asesor' | 'vendedor'
insert into public.internos (email, nombre, rol) values
  ('tucorreo@gmail.com', 'David', 'admin')
  -- , ('asesor1@...', 'Nombre', 'asesor')
  -- , ('vendedor1@...', 'Nombre', 'vendedor')
on conflict (email) do update set nombre=excluded.nombre, rol=excluded.rol;

-- Clientes comerciales. rol: 'cliente' | 'revendedor' | 'mayorista' | 'comisionista'
insert into public.catalogo_accesos (email, rol, activo) values
  ('mayorista1@...', 'mayorista', true),
  ('reventa1@...',   'revendedor', true),
  ('comision1@...',  'comisionista', true)
on conflict (email) do update set rol=excluded.rol, activo=true, actualizado_en=now();
```

> Quien no esté en ninguna tabla entra como **cliente** (solo precio público). Eso es lo seguro por defecto.

---

## Paso 3 · ⭐ Claim `role: authenticated` para TODOS los usuarios (lo más crítico)
Sin esto, tus usuarios internos/comerciales **no podrán cargar el catálogo** al actualizar.

En **Google Cloud Shell** del proyecto **technology-sales-web**:
```bash
git clone https://github.com/Avid0316/Catalogo-Technology-Sales.git
cd Catalogo-Technology-Sales && git checkout codex/security-hardening
npm install firebase-admin
gcloud config set project technology-sales-web
node scripts/set-prod-auth-claims.mjs
```
Debe imprimir algo como `claim aplicado: N`. Los usuarios lo toman al **volver a iniciar sesión** (o en ~1 h).

> 💡 Para que los usuarios **nuevos** lo reciban solos a futuro, conviene una *Blocking Function* (`beforeUserSignedIn`) — requiere plan Blaze. Lo dejamos como mejora aparte; no bloquea el rollout.

---

## Paso 4 · Apps Script (sincronización)
1. En el editor de Apps Script: **Configuración del proyecto → Propiedades del script** → creá `SUPABASE_SERVICE_KEY` con la clave **service_role** de Supabase (NO la pegues dentro del código).
2. **Implementar → Administrar implementaciones → Editar → Nueva versión** para publicar el `Inventario.gs` actualizado.

---

## Paso 5 · Publicar la web (mergear el PR #62)
Recién ahora: **Merge** del PR #62. El workflow despliega Hosting y `firestore.rules`.

---

## Paso 6 · Verificación (probá cada perfil)
- **Visitante (sin login):** ve catálogo, **sin** IMEI/costos/precios de mayoreo.
- **Cliente:** solo precio público.
- **Mayorista / Revendedor:** un solo precio (el suyo), sin IMEI.
- **Comisionista:** los 3 precios, IMEI enmascarado, sin módulos internos.
- **Vendedor / Asesor / Admin:** todo, con módulos internos.
- **Fotos** de equipos: solo se ven con sesión interna.

Si un usuario interno ve "Tu correo no está autorizado…": le falta el claim (Paso 3) o no está en `internos` (Paso 2).

---

## Después (mejora opcional)
- *Blocking Function* de Firebase para el claim automático de nuevos usuarios.
- Revisar `scripts/security-check.mjs` en CI.
