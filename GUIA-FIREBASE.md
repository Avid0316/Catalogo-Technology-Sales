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

El catálogo ya permite que **mayoristas, revendedores y clientes generales**
armen un carrito y envíen una **solicitud de cotización**. Esas solicitudes se
guardan en Firestore, en una colección llamada `cotizaciones`.

Para que se puedan guardar (incluso las de clientes que no inician sesión),
hay que pegar unas reglas. Es rápido:

1. En el menú izquierdo, entra a **"Firestore Database"**.
2. Arriba, clic en la pestaña **"Reglas"** (Rules).
3. **Borra** lo que haya y **pega exactamente esto**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       // Cualquiera puede ENVIAR una cotización (también clientes sin sesión).
       // Solo usuarios con sesión (asesores) pueden verlas o cambiarlas.
       match /cotizaciones/{id} {
         allow create: if true;
         allow read, update, delete: if request.auth != null;
       }

     }
   }
   ```

4. Clic en **"Publicar"** (Publish).

✅ Listo. Ahora las cotizaciones llegan a tu base de datos. En el panel del
asesor (siguiente etapa) las verás y podrás cambiarles el estado.

> 🔒 **Nota de seguridad:** `allow create: if true` solo permite *crear* una
> cotización nueva; nadie puede leer, editar ni borrar las de otros sin sesión.
> Más adelante afinamos esto para que solo tú y Miguel (admins) puedan leerlas.

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
