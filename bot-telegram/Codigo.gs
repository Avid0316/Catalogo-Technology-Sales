/**
 * ============================================================
 *  BOT DE TELEGRAM · Lectura automática de equipos
 *  Technology Sales
 * ============================================================
 *
 *  ¿Qué hace este bot?
 *  Cada vez que un compañero manda una FOTO al grupo de Telegram
 *  (la caja con el código de barras + el contrato de garantía):
 *
 *    1. Descarga la foto y la guarda en una carpeta de Google Drive.
 *    2. LEE la foto con inteligencia artificial (visión): saca el IMEI
 *       del código de barras y del contrato, el modelo, el cliente,
 *       el precio, el tipo (venta/entrega), la fecha, etc.
 *       👉 Tus compañeros NO tienen que escribir nada.
 *    3. Apunta todos los datos en una hoja de Google Sheets
 *       (una fila por equipo) para que verifiques contra facturación.
 *    4. Si la foto sale borrosa y NO se puede leer el IMEI, responde
 *       en el grupo pidiendo que manden el dato a mano.
 *
 *  La GUIA-BOT-TELEGRAM.md (en esta misma carpeta) explica paso a paso
 *  cómo ponerlo a funcionar. NO necesitas pagar servidor.
 * ============================================================
 */

// ============================================================
//  CONFIGURACIÓN  ·  cambia estos valores (ver la guía)
// ============================================================

// Token que te da @BotFather cuando creas el bot de Telegram.
var TOKEN = 'PEGA_AQUI_TU_TOKEN_DE_BOTFATHER';

// Llave de la IA que lee las fotos (de console.anthropic.com).
var ANTHROPIC_API_KEY = 'PEGA_AQUI_TU_LLAVE_DE_IA';

// ID de la hoja de cálculo (sale en el link de tu Google Sheet, entre /d/ y /edit).
var SHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_HOJA';

// ID de la carpeta de Drive donde se guardarán las fotos
// (sale en el link de la carpeta, después de /folders/).
var DRIVE_FOLDER_ID = 'PEGA_AQUI_EL_ID_DE_TU_CARPETA';

// Modelo de IA que lee las fotos. Opus es el más preciso con letra a mano.
// Si quieres gastar menos por foto, puedes cambiarlo a 'claude-haiku-4-5'
// (más barato, un poco menos exacto con la letra manuscrita).
var MODELO_IA = 'claude-opus-4-8';

// Nombre de la pestaña dentro de la hoja donde se apunta todo.
var NOMBRE_PESTANA = 'Equipos';

// (OPCIONAL) Para importar fotos VIEJAS en bloque: pon aquí el ID de una
// carpeta de Drive donde subiste las fotos antiguas (ej: el export de Telegram).
// Luego ejecuta la función "procesarFotosViejas" a mano. Ver la guía.
var CARPETA_FOTOS_VIEJAS = 'PEGA_AQUI_EL_ID_DE_LA_CARPETA_CON_FOTOS_VIEJAS';

// Modelo para la importación en BLOQUE de fotos viejas. Para muchas fotos
// (ej: 2000) conviene Haiku, que es ~7 veces más barato y lee el IMEI bien.
var MODELO_IA_IMPORTAR = 'claude-haiku-4-5';

// Híbrido: si al importar con Haiku el IMEI sale dudoso (no son 15 dígitos),
// reintenta esa foto con Opus (más caro pero más exacto). true = sí reintentar.
var REINTENTAR_CON_OPUS = true;

// ============================================================
//  No necesitas tocar nada de aquí para abajo.
// ============================================================

var API = 'https://api.telegram.org/bot' + TOKEN;

// Orden de las columnas en la hoja (debe coincidir con los encabezados).
var COLUMNAS = [
  'Fecha/Hora registro', 'Quién envió', 'IMEI', 'Modelo', 'Cliente',
  'ID cliente', 'Teléfono', 'Precio', 'Método de pago', 'Tipo',
  'Sitio de entrega', 'Entregado por', 'Vendedor', 'Fecha contrato',
  'Garantía', 'Estado', 'Foto', 'ID mensaje'
];

/**
 * Telegram llama a esta función cada vez que pasa algo en el grupo.
 */
function doPost(e) {
  try {
    var update = JSON.parse(e.postData.contents);
    var msg = update.message || update.channel_post;
    if (!msg) return responder200();

    // Caso 1: alguien RESPONDE a una foto para corregir/agregar un dato.
    if (msg.reply_to_message && (msg.text || msg.caption)) {
      manejarRespuesta(msg);
      return responder200();
    }

    // Caso 2: llega una FOTO nueva.
    if (msg.photo && msg.photo.length) {
      manejarFoto(msg);
      return responder200();
    }

    // Caso 3: comando de ayuda.
    if (msg.text && msg.text.indexOf('/start') === 0) {
      enviarMensaje(msg.chat.id,
        '✅ Bot activo. Manda la foto del equipo (caja con código de barras ' +
        'y/o el contrato de garantía) y yo saco los datos solo.');
    }
  } catch (err) {
    console.error('Error en doPost: ' + err);
  }
  return responder200();
}

/**
 * Procesa una foto nueva: la guarda, la LEE con IA y la apunta en la hoja.
 */
function manejarFoto(msg) {
  var chatId = msg.chat.id;
  var quien = nombrePersona(msg.from);

  // 1. Descargar la foto más grande (la última es la de mejor calidad).
  var foto = msg.photo[msg.photo.length - 1];
  var blob = descargarFoto(foto.file_id);

  // 2. Leer la foto con IA.
  var datos = {};
  if (blob) {
    try {
      datos = leerFotoConIA(Utilities.base64Encode(blob.getBytes()), blob.getContentType());
    } catch (err) {
      console.error('La IA no pudo leer la foto: ' + err);
    }
  }

  // 3. Guardar la foto en Drive (nombrada con el IMEI si se leyó).
  var linkFoto = blob
    ? guardarBlobEnDrive(blob, datos.imei || ('msg' + msg.message_id))
    : '(no se pudo descargar la foto)';

  // 4. ¿Se pudo leer el IMEI? (15 dígitos)
  var imei = (datos.imei || '').toString().replace(/\D/g, '');
  var imeiOk = /^\d{15}$/.test(imei);
  var estado = imeiOk ? '✅ Leído' : '⚠️ Revisar IMEI';

  // 5. Apuntar la fila en la hoja.
  var hoja = obtenerHoja();
  hoja.appendRow([
    new Date(),                      // Fecha/Hora registro
    quien,                           // Quién envió
    imeiOk ? imei : (datos.imei || ''), // IMEI
    datos.modelo || '',              // Modelo
    datos.cliente || '',             // Cliente
    datos.id_cliente || '',          // ID cliente
    datos.telefono || '',            // Teléfono
    datos.precio || '',              // Precio
    datos.metodo_pago || '',         // Método de pago
    datos.tipo || '',                // Tipo (venta/entrega)
    datos.sitio_entrega || '',       // Sitio de entrega
    datos.entregado_por || '',       // Entregado por
    datos.vendedor || '',            // Vendedor
    datos.fecha || '',               // Fecha del contrato
    datos.garantia || '',            // Garantía
    estado,                          // Estado
    linkFoto,                        // Foto
    String(msg.message_id)           // ID mensaje (para vincular respuestas)
  ]);

  // 6. Si no se pudo leer el IMEI, pedirlo en el grupo.
  if (!imeiOk) {
    enviarMensaje(chatId,
      '⚠️ ' + quien + ', no pude leer bien el *IMEI* de esta foto.\n' +
      'Por favor *responde a esta misma foto* escribiendo el IMEI, por ejemplo:\n' +
      'IMEI: 868677063192914',
      msg.message_id);
  }
}

/**
 * Cuando alguien responde a una foto para corregir o agregar un dato,
 * actualizamos la fila correspondiente.
 */
function manejarRespuesta(msg) {
  var idFotoOriginal = String(msg.reply_to_message.message_id);
  var texto = msg.text || msg.caption || '';

  var hoja = obtenerHoja();
  var rango = hoja.getDataRange().getValues();
  var colImei = 3, colEstado = 16, colMsgId = 18; // posiciones (1 = primera columna)

  for (var i = rango.length - 1; i >= 1; i--) {
    if (String(rango[i][colMsgId - 1]) === idFotoOriginal) {
      var fila = i + 1;

      // Buscar un IMEI (15 dígitos) en el texto de la respuesta.
      var m = texto.match(/\b(\d{15})\b/);
      if (m) {
        hoja.getRange(fila, colImei).setValue(m[1]);
        hoja.getRange(fila, colEstado).setValue('✅ Corregido');
        enviarMensaje(msg.chat.id, '✅ ¡Gracias! IMEI registrado: ' + m[1], msg.message_id);
      } else {
        enviarMensaje(msg.chat.id,
          'No encontré un IMEI de 15 dígitos en tu mensaje. Mándalo así: IMEI: 868677063192914',
          msg.message_id);
      }
      return;
    }
  }
}

/**
 * Le manda la foto a la IA y le pide que devuelva los datos en forma ordenada.
 * Usa la API de Anthropic por HTTP (Apps Script no tiene librería oficial).
 */
function leerFotoConIA(base64, contentType, modelo) {
  var instruccion =
    'Esta es la foto de un equipo de la tienda "Technology Sales": la caja con ' +
    'su código de barras y/o el contrato de garantía escrito a mano. ' +
    'Lee TODO lo que puedas (el código de barras y la letra a mano) y devuelve ' +
    'los datos. El IMEI son 15 dígitos (aparece en el código de barras y junto a ' +
    '"IMEI:" en el contrato). Si un dato no aparece o no se puede leer, déjalo vacío ("").';

  var schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      imei: { type: 'string', description: 'IMEI de 15 dígitos. Vacío si no se lee.' },
      modelo: { type: 'string', description: 'Modelo del equipo, ej: HONOR 90 256GB.' },
      cliente: { type: 'string', description: 'Nombre del cliente.' },
      id_cliente: { type: 'string', description: 'Número de identidad del cliente.' },
      telefono: { type: 'string', description: 'Teléfono o N.º del cliente.' },
      precio: { type: 'string', description: 'Precio, ej: 5,000 LPS.' },
      metodo_pago: { type: 'string', description: 'Efectivo, Transban, POS, etc.' },
      tipo: { type: 'string', description: 'Venta o Entrega (según lo marcado).' },
      sitio_entrega: { type: 'string', description: 'Tienda o Envío y lugar.' },
      entregado_por: { type: 'string', description: 'Quién entregó el equipo.' },
      vendedor: { type: 'string', description: 'Número o nombre del vendedor.' },
      fecha: { type: 'string', description: 'Fecha del contrato.' },
      garantia: { type: 'string', description: 'Tiempo de garantía, ej: 60 días.' }
    },
    required: ['imei', 'modelo', 'cliente', 'id_cliente', 'telefono', 'precio',
      'metodo_pago', 'tipo', 'sitio_entrega', 'entregado_por', 'vendedor', 'fecha', 'garantia']
  };

  var payload = {
    model: modelo || MODELO_IA,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: contentType || 'image/jpeg', data: base64 } },
        { type: 'text', text: instruccion }
      ]
    }],
    output_config: { format: { type: 'json_schema', schema: schema } }
  };

  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var cuerpo = JSON.parse(res.getContentText());
  if (cuerpo.error) throw new Error(cuerpo.error.message || res.getContentText());

  // La respuesta trae el JSON dentro del primer bloque de texto.
  var texto = '';
  (cuerpo.content || []).forEach(function (b) { if (b.type === 'text') texto += b.text; });
  return JSON.parse(texto);
}

/**
 * Descarga una foto de Telegram y devuelve su contenido (blob).
 */
function descargarFoto(fileId) {
  try {
    var info = JSON.parse(UrlFetchApp.fetch(API + '/getFile?file_id=' + fileId).getContentText());
    var filePath = info.result.file_path;
    return UrlFetchApp.fetch('https://api.telegram.org/file/bot' + TOKEN + '/' + filePath).getBlob();
  } catch (err) {
    console.error('No se pudo descargar la foto: ' + err);
    return null;
  }
}

/**
 * Guarda un blob (la foto ya descargada) en la carpeta de Drive y devuelve el link.
 */
function guardarBlobEnDrive(blob, nombreBase) {
  try {
    var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    blob.setName(nombreBase + '_' + fecha + '.jpg');
    var carpeta = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var archivo = carpeta.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return archivo.getUrl();
  } catch (err) {
    console.error('No se pudo guardar la foto: ' + err);
    return '(no se pudo guardar la foto)';
  }
}

/**
 * Devuelve la pestaña de la hoja, creándola con encabezados si no existe.
 */
function obtenerHoja() {
  var libro = SpreadsheetApp.openById(SHEET_ID);
  var hoja = libro.getSheetByName(NOMBRE_PESTANA);
  if (!hoja) {
    hoja = libro.insertSheet(NOMBRE_PESTANA);
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function nombrePersona(from) {
  if (!from) return 'Desconocido';
  var nombre = [from.first_name, from.last_name].filter(Boolean).join(' ');
  return nombre || (from.username ? '@' + from.username : 'Desconocido');
}

function enviarMensaje(chatId, texto, responderA) {
  var payload = { chat_id: chatId, text: texto, parse_mode: 'Markdown' };
  if (responderA) payload.reply_to_message_id = responderA;
  try {
    UrlFetchApp.fetch(API + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('No se pudo enviar el mensaje: ' + err);
  }
}

function responder200() {
  return ContentService.createTextOutput('ok');
}

/**
 * ============================================================
 *  IMPORTAR FOTOS VIEJAS EN BLOQUE
 * ============================================================
 *  El bot NO puede leer fotos que se mandaron al grupo ANTES de instalarlo
 *  (Telegram no le entrega el historial). Para recuperarlas:
 *
 *   1. Sube las fotos viejas a una carpeta de Drive (por ejemplo, las del
 *      export de Telegram Desktop, o reenviadas/descargadas a mano).
 *   2. Pega el ID de esa carpeta arriba, en CARPETA_FOTOS_VIEJAS.
 *   3. Ejecuta esta función "procesarFotosViejas" desde el editor.
 *
 *  Lee cada foto con IA, la apunta en la MISMA hoja y luego la mueve a una
 *  subcarpeta "Procesadas" para no repetirla.
 *
 *  Para MUCHAS fotos (ej: 2000) NO la ejecutes a mano una y otra vez: usa
 *  "instalarImportacionAutomatica" (abajo) y el bot las irá procesando solo
 *  en tandas, hasta terminar. Usa el modelo MODELO_IA_IMPORTAR (Haiku) y, si
 *  REINTENTAR_CON_OPUS está activo, reintenta con Opus las de IMEI dudoso.
 */
function procesarFotosViejas() {
  var inicio = new Date().getTime();
  var hoja = obtenerHoja();
  var carpeta = DriveApp.getFolderById(CARPETA_FOTOS_VIEJAS);
  var procesadas = obtenerSubcarpeta(carpeta, 'Procesadas');

  var archivos = carpeta.getFiles();
  var leidas = 0, conImei = 0;

  while (archivos.hasNext()) {
    // Cuidado con el límite de 6 minutos de Apps Script: paramos a los 5.
    if (new Date().getTime() - inicio > 5 * 60 * 1000) {
      Logger.log('Pausa por tiempo. Continúa en la próxima tanda automática.');
      break;
    }

    var archivo = archivos.next();
    var tipo = archivo.getMimeType();
    if (tipo.indexOf('image/') !== 0) continue; // solo fotos

    var base64 = Utilities.base64Encode(archivo.getBlob().getBytes());
    var datos = {};
    try {
      // 1er intento: modelo económico (Haiku) para la importación masiva.
      datos = leerFotoConIA(base64, tipo, MODELO_IA_IMPORTAR);
    } catch (err) {
      console.error('No se pudo leer ' + archivo.getName() + ': ' + err);
    }

    var imei = (datos.imei || '').toString().replace(/\D/g, '');
    var imeiOk = /^\d{15}$/.test(imei);

    // 2do intento (híbrido): si el IMEI salió dudoso, reintenta con Opus.
    if (!imeiOk && REINTENTAR_CON_OPUS && MODELO_IA_IMPORTAR !== MODELO_IA) {
      try {
        var datos2 = leerFotoConIA(base64, tipo, MODELO_IA);
        var imei2 = (datos2.imei || '').toString().replace(/\D/g, '');
        if (/^\d{15}$/.test(imei2)) { datos = datos2; imei = imei2; imeiOk = true; }
      } catch (err) {
        console.error('Reintento con Opus falló en ' + archivo.getName() + ': ' + err);
      }
    }
    if (imeiOk) conImei++;

    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    hoja.appendRow([
      archivo.getDateCreated(),            // Fecha/Hora (la del archivo)
      'Importado (foto vieja)',            // Quién envió
      imeiOk ? imei : (datos.imei || ''),  // IMEI
      datos.modelo || '', datos.cliente || '', datos.id_cliente || '',
      datos.telefono || '', datos.precio || '', datos.metodo_pago || '',
      datos.tipo || '', datos.sitio_entrega || '', datos.entregado_por || '',
      datos.vendedor || '', datos.fecha || '', datos.garantia || '',
      imeiOk ? '✅ Importado' : '⚠️ Revisar IMEI', // Estado
      archivo.getUrl(),                    // Foto
      'import'                             // ID mensaje
    ]);

    // Mover a "Procesadas" para no repetirla en la próxima tanda.
    procesadas.addFile(archivo);
    carpeta.removeFile(archivo);
    leidas++;
  }

  // ¿Ya no quedan fotos? Apaga el temporizador automático si estaba puesto.
  if (!carpeta.getFiles().hasNext()) {
    detenerImportacionAutomatica();
    Logger.log('🎉 Importación TERMINADA. No quedan fotos por procesar.');
  }

  Logger.log('Tanda lista: ' + leidas + ' fotos importadas (' + conImei + ' con IMEI).');
}

/**
 * Enciende el temporizador: procesa las fotos solo, en tandas, cada 5 minutos,
 * hasta vaciar la carpeta. Ejecútala UNA vez y deja que trabaje (puede tardar
 * horas con muchas fotos). Se apaga solo al terminar.
 */
function instalarImportacionAutomatica() {
  detenerImportacionAutomatica(); // evita duplicados
  ScriptApp.newTrigger('procesarFotosViejas').timeBased().everyMinutes(5).create();
  procesarFotosViejas(); // arranca de una vez la primera tanda
  Logger.log('✅ Temporizador encendido: procesará fotos cada 5 minutos hasta terminar.');
}

/** Apaga el temporizador de importación (lo hace solo al terminar, o a mano). */
function detenerImportacionAutomatica() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'procesarFotosViejas') ScriptApp.deleteTrigger(t);
  });
}

/** Devuelve la subcarpeta con ese nombre, creándola si no existe. */
function obtenerSubcarpeta(carpeta, nombre) {
  var existentes = carpeta.getFoldersByName(nombre);
  return existentes.hasNext() ? existentes.next() : carpeta.createFolder(nombre);
}

/**
 * ============================================================
 *  AYUDANTES · ejecútalos UNA VEZ a mano desde el editor
 *  (menú de funciones, arriba), siguiendo la guía.
 * ============================================================
 */

// Ejecuta esto UNA vez después de publicar la app web, para conectar
// el bot con tu script. Pega la URL de tu app web donde dice.
function activarWebhook() {
  var URL_DE_TU_APP_WEB = 'PEGA_AQUI_LA_URL_DE_TU_APP_WEB';
  Logger.log(UrlFetchApp.fetch(API + '/setWebhook?url=' + encodeURIComponent(URL_DE_TU_APP_WEB)).getContentText());
}

// Si quieres desconectar el bot temporalmente.
function quitarWebhook() {
  Logger.log(UrlFetchApp.fetch(API + '/deleteWebhook').getContentText());
}

// Para confirmar que el bot quedó bien conectado.
function verEstado() {
  Logger.log(UrlFetchApp.fetch(API + '/getWebhookInfo').getContentText());
}
