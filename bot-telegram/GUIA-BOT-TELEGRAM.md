# 🤖 Guía paso a paso: Bot de Telegram que lee tus equipos

Este bot vive en tu grupo de Telegram. Cuando un compañero manda la **foto**
de un equipo (la caja con código de barras y/o el contrato de garantía), el bot:

1. **Guarda la foto** en una carpeta de Google Drive.
2. **Lee la foto solo** con inteligencia artificial y saca: IMEI, modelo,
   cliente, precio, tipo (venta/entrega), fecha, etc.
3. **Apunta todo** en una hoja de Google Sheets, una fila por equipo.
4. Si la foto sale borrosa y no se lee el IMEI, **pide el dato** en el grupo.

Así puedes abrir la hoja y **verificar que todo esté facturado**. Tus
compañeros siguen mandando la foto como siempre, sin escribir nada.

> 💡 **No necesitas servidor ni pagar hosting.** Todo corre gratis en Google
> Apps Script. Lo único que tiene un costo pequeño es la lectura con IA
> (unos centavos por foto), y trae una bolsa de crédito gratis para empezar.

---

## Lo que vas a necesitar (todo gratis para empezar)

- Tu cuenta de Google (la misma de siempre).
- La app de Telegram.
- Unos 20 minutos.

Vamos por partes. Sigue el orden.

---

## Paso 1 · Crear el bot en Telegram

1. En Telegram, busca **@BotFather** (tiene un check azul) y ábrelo.
2. Escríbele **/newbot** y dale enviar.
3. Te pedirá un **nombre** (ej: `Control Technology Sales`).
4. Luego un **usuario** que termine en `bot` (ej: `technologysales_control_bot`).
5. BotFather te dará un **TOKEN**, algo como:
   `8123456789:AAH4k...`
   📋 **Cópialo y guárdalo.** Es el `TOKEN` del Paso 5.
6. Mándale a BotFather **/setprivacy** → elige tu bot → **Disable**.
   *(Esto permite que el bot vea las fotos del grupo. Importante.)*

---

## Paso 2 · Crear la carpeta de fotos y la hoja en Google

### 2a · La carpeta de Drive (donde se guardan las fotos)

1. Entra a [drive.google.com](https://drive.google.com).
2. Botón **Nuevo → Carpeta nueva**, ponle `Fotos equipos`.
3. Ábrela. Mira el link en el navegador, se ve así:
   `https://drive.google.com/drive/folders/`**`1A2B3C4D5E6F...`**
4. 📋 Copia esa parte final (después de `/folders/`). Es tu `DRIVE_FOLDER_ID`.

### 2b · La hoja de Google Sheets (donde se apuntan los datos)

1. Entra a [sheets.google.com](https://sheets.google.com) y crea una **hoja en blanco**.
2. Ponle un nombre arriba, ej: `Control de equipos`.
3. Mira el link, se ve así:
   `https://docs.google.com/spreadsheets/d/`**`1X2Y3Z...`**`/edit`
4. 📋 Copia la parte del medio (entre `/d/` y `/edit`). Es tu `SHEET_ID`.

*(No tienes que poner títulos a las columnas; el bot las crea solo la primera vez.)*

---

## Paso 3 · Conseguir la llave de la IA (la que lee las fotos)

1. Entra a 👉 [console.anthropic.com](https://console.anthropic.com) e inicia sesión
   (puedes usar tu cuenta de Google).
2. En el menú, entra a **API Keys** → **Create Key**.
3. Ponle un nombre (ej: `bot-telegram`) y créala.
4. 📋 Te mostrará la llave **una sola vez** (empieza con `sk-ant-...`). Cópiala
   y guárdala bien. Es tu `ANTHROPIC_API_KEY`.
5. Para que funcione, agrega un poco de saldo en **Billing → Add credits**
   (con $5 te alcanza para miles de fotos; cada foto cuesta centavos).

> 💡 ¿Quieres gastar menos por foto? En el código puedes cambiar `MODELO_IA`
> de `'claude-opus-4-8'` a `'claude-haiku-4-5'` (más barato, un poquito menos
> exacto leyendo letra a mano). Para empezar, deja Opus.

---

## Paso 4 · Crear el proyecto de Apps Script

1. Entra a 👉 [script.google.com](https://script.google.com).
2. Clic en **Proyecto nuevo**.
3. Arriba, donde dice "Proyecto sin título", ponle `Bot Technology Sales`.
4. Verás un archivo `Código.gs` con algo de texto. **Borra todo** lo que haya.
5. Abre el archivo **`Codigo.gs`** que está en esta misma carpeta del proyecto,
   **copia todo su contenido** y **pégalo** en el editor de Apps Script.
6. Clic en el ícono de **guardar** (💾).

---

## Paso 5 · Pegar tus datos en el código

Arriba del todo del código verás unas líneas con `PEGA_AQUI...`. Reemplaza
cada una con lo que copiaste en los pasos anteriores (deja las comillas):

```js
var TOKEN = 'el token de BotFather (Paso 1)';
var ANTHROPIC_API_KEY = 'tu llave sk-ant-... (Paso 3)';
var SHEET_ID = 'el id de tu hoja (Paso 2b)';
var DRIVE_FOLDER_ID = 'el id de tu carpeta (Paso 2a)';
```

Guarda (💾) otra vez.

---

## Paso 6 · Publicar el bot como "app web"

1. Arriba a la derecha, clic en **Implementar → Nueva implementación**.
2. Clic en el engranaje ⚙️ y elige **Aplicación web**.
3. Configura así:
   - **Descripción:** `bot`
   - **Ejecutar como:** `Yo`
   - **Quién tiene acceso:** **Cualquier usuario** *(importante para que
     Telegram pueda avisarle al bot)*.
4. Clic en **Implementar**.
5. Te pedirá **permisos**: clic en **Autorizar acceso**, elige tu cuenta, y si
   sale una advertencia, clic en **Configuración avanzada → Ir a (tu proyecto)
   → Permitir**. *(Es normal, es tu propio proyecto.)*
6. Al final te dará una **URL de la app web** (termina en `/exec`).
   📋 **Cópiala.**

---

## Paso 7 · Conectar Telegram con tu bot

1. En el editor de Apps Script, busca arriba la función `activarWebhook`
   en la lista desplegable de funciones.
2. Dentro de esa función, pega la **URL de la app web** del Paso 6 donde dice
   `PEGA_AQUI_LA_URL_DE_TU_APP_WEB`. Guarda (💾).
3. Selecciona la función **`activarWebhook`** en el desplegable y clic en
   **Ejecutar** (▶️).
4. Abre **Registro de ejecución** (abajo): si dice `"ok":true`, ¡quedó conectado! ✅

*(Si algo falla, ejecuta `verEstado` para ver qué dice Telegram.)*

---

## Paso 8 · Agregar el bot al grupo y probar

1. En tu grupo de Telegram, **Agregar miembro** → busca tu bot por su usuario
   (el que termina en `bot`) → agrégalo.
2. Hazlo **administrador** del grupo (así ve todos los mensajes).
3. Manda una **foto de prueba** de un equipo (caja con código de barras o
   contrato).
4. En unos segundos:
   - La foto aparece en tu carpeta de Drive.
   - Una fila nueva aparece en tu hoja con el IMEI, modelo, cliente, etc.
   - Si no se leyó el IMEI, el bot responde pidiéndolo.

🎉 **¡Listo!** Ya tienes tu control automático para verificar facturación.

---

## ¿Cómo lo uso en el día a día?

- Tus compañeros mandan la foto **como siempre**. No tienen que escribir nada.
- Tú abres la **hoja de Google Sheets** cuando quieras y la cruzas con tus
  facturas (puedes filtrar por IMEI, por compañero o por fecha).
- Si una foto salió borrosa, el bot avisa en el grupo: alguien **responde a esa
  foto** con `IMEI: 868677063192914` y el bot corrige la fila solo.

---

## Preguntas comunes

**¿Es seguro?** Sí. Todo queda en TU Google (tu Drive y tu hoja) y en tu propio
bot. La llave de IA es tuya y privada — no la compartas ni la subas a internet.

**¿Cuánto cuesta?** Telegram, Drive, Sheets y Apps Script son **gratis**. Solo
la lectura con IA cuesta unos **centavos por foto**, y empiezas con crédito
gratis. Con $5 lees miles de fotos.

**¿Y si quiero más columnas o cambiar algo?** Avísame y lo ajusto. El código
está comentado en español para que se entienda.

**¿Funciona con fotos solo de la caja, o solo del contrato?** Con las dos. Lee
lo que haya: el código de barras de la caja y/o el contrato escrito a mano.

---

## Si algo no funciona

Mándame una captura de:
- El **Registro de ejecución** de Apps Script, o
- Lo que sale al ejecutar `verEstado`.

Con eso te ayudo a destrabarlo. 💪
