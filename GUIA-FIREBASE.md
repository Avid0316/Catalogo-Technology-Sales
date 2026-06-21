# 🔥 Guía paso a paso: Crear tu proyecto Firebase

Esta guía te lleva desde cero hasta tener tu proyecto Firebase listo para
conectar al catálogo. Son unos 10-15 minutos. **Todo es gratis.**

---

## Paso 1 · Entrar a Firebase

1. Abre 👉 [https://firebase.google.com](https://firebase.google.com)
2. Clic en **"Comenzar"** (o "Get started").
3. Inicia sesión con tu correo de Google (el mismo de siempre).

---

## Paso 2 · Crear el proyecto

1. Clic en **"Crear un proyecto"** (o "Add project").
2. **Nombre del proyecto:** escribe algo como `technology-sales`.
3. Te preguntará por **Google Analytics**: para empezar puedes
   **desactivarlo** (lo puedes activar después si quieres estadísticas).
4. Clic en **"Crear proyecto"** y espera unos segundos.
5. Cuando diga "Tu proyecto está listo", clic en **"Continuar"**.

✅ Ya tienes tu "local" en Firebase.

---

## Paso 3 · Registrar tu página web

1. En la pantalla principal, busca el ícono **`</>`** (Web) y haz clic.
2. **Apodo de la app:** escribe `catalogo-web`.
3. Marca la casilla **"Configurar Firebase Hosting"** (lo usaremos para
   publicar la web).
4. Clic en **"Registrar app"**.
5. Te mostrará un bloque de código con tus **llaves** (`firebaseConfig`).
   Se ve parecido a esto:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "technology-sales.firebaseapp.com",
     projectId: "technology-sales",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

   📋 **Copia ese bloque y guárdalo.** Me lo vas a pasar para conectar la web.
   *(No te preocupes, estas llaves son seguras de compartir — la protección
   real la dan las "Security Rules", no estas llaves.)*

6. Clic en **"Continuar a la consola"** (puedes saltarte los pasos de
   instalación que muestra, yo me encargo de esa parte).

---

## Paso 4 · Activar el Login (Authentication)

1. En el menú de la izquierda, entra a **"Authentication"**.
2. Clic en **"Comenzar"**.
3. En la pestaña **"Sign-in method"**, elige **"Correo electrónico/contraseña"**.
4. Actívalo (el primer interruptor) y clic en **"Guardar"**.
5. Ve a la pestaña **"Users"** → **"Agregar usuario"** y crea tus accesos:
   - Correo: `david@technology.com` · Contraseña: la que quieras
   - Correo: `mayorista@technology.com` · Contraseña: la que quieras
   - Correo: `revendedor@technology.com` · Contraseña: la que quieras

   *(Usamos correos en vez de "david/mayorista1" porque Firebase trabaja con
   correos. El rol de cada uno lo definiremos en la base de datos.)*

✅ Tus contraseñas ahora viven seguras en Google, fuera del código.

---

## Paso 5 · Crear la base de datos (Firestore)

1. En el menú izquierdo, entra a **"Firestore Database"**.
2. Clic en **"Crear base de datos"**.
3. Elige **"Iniciar en modo de producción"** (más seguro; las reglas las
   ajustamos después juntos).
4. **Ubicación:** elige una cercana, por ejemplo `us-central` o
   `southamerica-east1`. Clic en **"Habilitar"**.

✅ Ya tienes dónde guardar productos, usuarios y pedidos. La llenamos juntos
en el siguiente paso del proyecto.

---

## Paso 6 · Reglas para recibir cotizaciones (carrito)

Las reglas completas viven en el archivo `firestore.rules`. No copies reglas
parciales desde esta guía y no uses una condición basada únicamente en
`request.auth != null`: cualquier cliente autenticado podría leer o modificar
cotizaciones ajenas.

El archivo actual aplica estas restricciones:

- Un visitante puede crear una cotización validada, pero no leerla después.
- Un cliente autenticado solo puede leer sus propias cotizaciones.
- Admin, asesor y vendedor pueden leer y actualizar cotizaciones.
- Solo admin puede eliminarlas.
- Campos, tamaños y estado inicial son validados.

Las reglas se despliegan automáticamente junto con producción mediante
`.github/workflows/firebase-deploy.yml`. Para un despliegue manual:

```bash
firebase deploy --only firestore:rules --project technology-sales-web
```

---

## Paso 7 · Usuarios y roles (colección `usuarios`)

Para no tener que tocar el código cada vez que agregas un empleado o cliente,
los **roles viven en la base de datos**, en una colección llamada `usuarios`.

### 7.1 · Crear un usuario en la colección

1. **Authentication → Users → Agregar usuario:** crea el correo + contraseña
   (esto es para que pueda iniciar sesión).
2. **Firestore Database → Iniciar colección** (o "Agregar documento" si ya
   existe) con el nombre **`usuarios`**.
3. Crea un **documento** cuyo **ID sea el correo** del usuario (ej.
   `carlos@ts.com`) y agrégale estos campos:

   | Campo  | Tipo   | Ejemplo                     |
   |--------|--------|-----------------------------|
   | `role` | string | `vendedor`                  |
   | `name` | string | `Carlos`                    |

   Valores válidos para **`role`**:
   `admin` · `asesor` · `vendedor` · `comisionista` · `mayorista` ·
   `revendedor` · `cliente`

   > 💡 Repite para cada persona. Para cambiarle el rol a alguien, solo editas
   > su campo `role` — sin tocar código.

### 7.2 · Lectura segura del rol

`firestore.rules` permite que cada usuario lea únicamente su propio perfil y
que el administrador consulte la lista. Si un usuario no existe en `usuarios`,
entra como **cliente** y solo recibe el catálogo público.

---

## Paso 8 · Reglas para el panel de usuarios

No edites bloques aislados desde la consola. Usa `firestore.rules`, que permite:

- Administración completa únicamente a usuarios con `role: admin`.
- Lectura del perfil propio.
- Edición personal limitada a nombre, contacto, negocio y direcciones.
- Prohibición de cambiar el rol propio.
- El rol `comisionista` puede consultar los tres precios, pero no recibe acceso
  al panel de cotizaciones ni a los módulos internos.

> ⚠️ **MUY importante:** para que `isAdmin()` te reconozca, **tu propio usuario
> admin debe existir en la colección `usuarios` con `role: admin`**. O sea,
> crea los documentos de `avid@ts.com` y `miguel@ts.com` con `role = admin`
> (Paso 7) **antes** de usar el panel. Si no, el panel dirá que no puede cargar
> los usuarios.

> 🔒 Esta regla impide que un mayorista/revendedor se cambie el rol a sí mismo
> (no puede auto-ascenderse a admin). Solo puede editar sus datos y direcciones.

✅ Con esto ya puedes administrar usuarios y roles **desde la página**, sin entrar
a la consola de Firebase.

---

## ✅ Cuando termines

Pásame **dos cosas**:
1. El bloque `firebaseConfig` del Paso 3.
2. Los correos que creaste en el Paso 4 (las contraseñas NO me las mandes).

Con eso conecto tu página al login real de Firebase manteniendo tu diseño
actual, y seguimos con la base de datos.

---

## 💡 Notas

- **Costo:** todo lo anterior es gratis (plan Spark). No te pedirá tarjeta.
- **Sin publicidad:** Firebase nunca mete anuncios en tu web.
- **Si algo se ve diferente:** Firebase cambia de vez en cuando los textos de
  los botones, pero el orden de los pasos es el mismo. Si te trabas en alguno,
  mándame captura y te ayudo.
