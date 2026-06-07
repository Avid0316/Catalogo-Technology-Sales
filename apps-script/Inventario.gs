/***********************************************************************
 * TechnologySales · API del Catálogo (completa)
 * -------------------------------------------------------------------
 * Trabaja con TU estructura de hojas:
 *   Crudo · Diccionario_Modelos · Diccionario_Almacenamientos ·
 *   Diccionario_Colores · Inventario · Precios
 *
 * Tiene DOS partes:
 *
 *  1) construirInventario()  → lee "Crudo", aplica los 3 diccionarios y
 *     escribe la hoja "Inventario" lista para la web.
 *     (Menú TechnologySales ▸ Construir inventario)
 *
 *  2) doGet()  → lee "Inventario" + "Precios", los une por
 *     Marca|Modelo|Capacidad y entrega el JSON para el sitio.
 *     Incluye: Precio Cliente Final, Comprometido y Chip.
 ***********************************************************************/

/* ===================================================================
 * PARTE 1 — CONSTRUIR INVENTARIO DESDE CRUDO (con diccionarios)
 * =================================================================== */

var CHIP_RE = /(DUAL\s*SIM|DUALSIM|2\s*SIM|1\s*SIM|E\s*SIM|ESIM|FISICO)/i;

function detectarChip_(name) {
  var m = String(name).toUpperCase().match(CHIP_RE);
  if (!m) return "";
  var x = m[1].toUpperCase().replace(/\s+/g, "");
  if (x === "DUALSIM" || x === "2SIM") return "Dual SIM";
  if (x === "1SIM") return "1 SIM";
  if (x === "ESIM") return "eSIM";
  if (x === "FISICO") return "SIM física";
  return "";
}

// Carga un diccionario [Texto a buscar, valor...] ordenado del texto más
// largo al más corto (para que "16 PRO MAX" gane sobre "16 PRO").
function cargarDiccionario_(nombreHoja) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombreHoja);
  if (!sh) throw new Error('Falta la hoja "' + nombreHoja + '".');
  var values = sh.getDataRange().getValues();
  var lista = [];
  for (var r = 1; r < values.length; r++) {           // salta encabezado
    var buscar = String(values[r][0] || "").trim().toUpperCase();
    if (!buscar) continue;
    lista.push({ buscar: buscar, fila: values[r] });
  }
  lista.sort(function (a, b) { return b.buscar.length - a.buscar.length; });
  return lista;
}

function construirInventario() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var crudo = ss.getSheetByName("Crudo");
  if (!crudo) throw new Error('Falta la hoja "Crudo".');

  var values = crudo.getDataRange().getValues();
  // Encuentra la fila de encabezados (la que tiene "NombreProducto").
  var hRow = -1;
  for (var r = 0; r < Math.min(values.length, 10); r++) {
    if (values[r].indexOf("NombreProducto") !== -1) { hRow = r; break; }
  }
  if (hRow === -1) throw new Error('En "Crudo" no encuentro la columna "NombreProducto".');

  var H = {}, head = values[hRow];
  for (var c = 0; c < head.length; c++) H[String(head[c]).trim()] = c;
  function col(n) { if (H[n] === undefined) throw new Error('Falta la columna "' + n + '" en Crudo.'); return H[n]; }

  var iNom = col("NombreProducto"),
      iSuc = col("NombreSucursal"),
      iGru = col("NombreGrupoProducto"),
      iCons = col("CantidadConsignacion"),
      iComp = col("Comprometido"),
      iVirt = col("CantidadVirtual");

  var dicModelos = cargarDiccionario_("Diccionario_Modelos");        // [buscar, Marca, Modelo, Categoria]
  var dicAlmac   = cargarDiccionario_("Diccionario_Almacenamientos");// [buscar, Almacenamiento correcto]
  var dicColores = cargarDiccionario_("Diccionario_Colores");        // [buscar, Color correcto]

  // Capacidad/Color: el texto a buscar SÍ aparece pegado (ej. "128GB/4RAM", "AZUL MARINO").
  function buscarEn_(dic, texto) {
    for (var i = 0; i < dic.length; i++) {
      if (texto.indexOf(dic[i].buscar) !== -1) return dic[i].fila;
    }
    return null;
  }
  // Modelo: casa si TODAS las palabras del modelo están en el nombre (aunque la
  // capacidad/color estén en medio, ej. "IPAD 11VA 128GB ROSADO WIFI").
  function buscarModelo_(dic, tokens) {
    for (var i = 0; i < dic.length; i++) {
      var palabras = dic[i].buscar.split(/\s+/), ok = true;
      for (var w = 0; w < palabras.length; w++) {
        if (palabras[w] && !tokens[palabras[w]]) { ok = false; break; }
      }
      if (ok) return dic[i].fila;
    }
    return null;
  }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }

  var salida = [["Categoria","Marca","Modelo","Capacidad","Color","Chip",
                 "Sucursal","CantidadVirtual","CantidadConsignacion","Comprometido",
                 "Cantidad","Estado","NombreProductoOriginal"]];
  var sinModelo = [];

  for (var r2 = hRow + 1; r2 < values.length; r2++) {
    var row = values[r2];
    var nombre = String(row[iNom] || "").trim();
    if (!nombre) continue;

    var virt = num(row[iVirt]), cons = num(row[iCons]), comp = num(row[iComp]);
    var disp = virt + cons;
    if (disp <= 0 && comp <= 0) continue;           // agotados: no entran

    var up = nombre.toUpperCase();
    var tokens = {};
    up.split(/\s+/).forEach(function (t) { if (t) tokens[t] = true; });

    var fm = buscarModelo_(dicModelos, tokens);
    if (!fm) { if (sinModelo.indexOf(nombre) === -1) sinModelo.push(nombre); continue; }

    var fa = buscarEn_(dicAlmac, up);
    var fc = buscarEn_(dicColores, up);

    salida.push([
      fm[3] || "",                  // Categoria
      fm[1] || "",                  // Marca
      fm[2] || "",                  // Modelo
      fa ? (fa[1] || "") : "",      // Capacidad
      fc ? (fc[1] || "") : "",      // Color
      detectarChip_(nombre),        // Chip
      String(row[iSuc] || "").trim(),
      virt, cons, comp,
      disp,                         // Cantidad = Disponible
      String(row[iGru] || "").trim(),
      nombre
    ]);
  }

  var inv = ss.getSheetByName("Inventario") || ss.insertSheet("Inventario");
  inv.clearContents();
  inv.getRange(1, 1, salida.length, salida[0].length).setValues(salida);
  inv.setFrozenRows(1);

  var msg = "Inventario construido: " + (salida.length - 1) + " filas con stock.";
  if (sinModelo.length) {
    msg += "\n\n⚠️ " + sinModelo.length + " productos sin modelo en el diccionario (ejemplos):\n- " +
           sinModelo.slice(0, 10).join("\n- ");
  }
  notificar_(msg);
}

// Muestra un aviso. Si se corre desde el editor (sin interfaz), no falla:
// usa toast y, en último caso, lo deja en el registro de ejecución.
function notificar_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
    return;
  } catch (e) {}
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(String(msg).substring(0, 250), "TechnologySales", 10);
  } catch (e2) {}
  Logger.log(msg);
}

/* ===================================================================
 * PARTE 2 — API WEB (Inventario + Precios → JSON)   [basado en tu doGet]
 * =================================================================== */

function doGet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var inventarioSheet = ss.getSheetByName("Inventario");
    var preciosSheet = ss.getSheetByName("Precios");

    if (!inventarioSheet) return jsonOutput({ error: true, mensaje: "No existe la hoja Inventario" });
    if (!preciosSheet)    return jsonOutput({ error: true, mensaje: "No existe la hoja Precios" });

    var inventario = sheetToObjects(inventarioSheet);
    var precios = sheetToObjects(preciosSheet);

    // Mapa de precios por Marca|Modelo|Capacidad
    var preciosMap = {};
    precios.forEach(function (item) {
      var key = makeKey(item["Marca"], item["Modelo"], item["Capacidad"]);
      preciosMap[key] = {
        precioMayorista:    formatLempiras(item["Precio Mayorista"]),
        precioReventa:      formatLempiras(item["Precio Reventa"]),
        precioClienteFinal: formatLempiras(item["Precio Cliente Final"]),
        imagen:             item["Imagen"] || ""
      };
    });

    var resultado = inventario.map(function (item) {
      var key = makeKey(item["Marca"], item["Modelo"], item["Capacidad"]);
      var p = preciosMap[key] || {};
      return {
        Categoria:    item["Categoria"] || "",
        Marca:        item["Marca"] || "",
        Modelo:       item["Modelo"] || "",
        Capacidad:    item["Capacidad"] || "",
        Color:        item["Color"] || "",
        Chip:         item["Chip"] || "",
        Sucursal:     item["Sucursal"] || "",
        Cantidad:     item["Cantidad"] || 0,
        Consignacion: item["CantidadConsignacion"] || 0,
        Comprometido: item["Comprometido"] || 0,
        Estado:       item["Estado"] || "",
        "Precio Mayorista": p.precioMayorista || "",
        "Precio Reventa":   p.precioReventa || "",
        "Precio Publico":   p.precioClienteFinal || "",   // Cliente Final → "Precio Publico" (lo que usa el sitio)
        Imagen:       p.imagen || ""
      };
    });

    return jsonOutput(resultado);
  } catch (error) {
    return jsonOutput({ error: true, mensaje: error.message });
  }
}

/* ===================== HELPERS (los tuyos) ===================== */

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data.shift().map(function (h) { return String(h).trim(); });
  return data.map(function (row) {
    var obj = {};
    headers.forEach(function (header, index) { obj[header] = row[index]; });
    return obj;
  });
}

function makeKey(marca, modelo, capacidad) {
  return [marca || "", modelo || "", capacidad || ""]
    .map(function (v) { return String(v).trim().toUpperCase(); })
    .join("|");
}

function formatLempiras(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";
  var numero = Number(valor);
  if (isNaN(numero)) return String(valor);   // por si viene "AGOTADO" u otro texto
  return "L " + numero.toLocaleString("es-HN");
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===================================================================
 * PARTE 3 — GUARDAR PRECIOS DESDE LA WEB (doPost)
 * El panel de admin del sitio manda un POST para guardar en "Precios".
 * =================================================================== */

// 👇 Correos que PUEDEN guardar precios desde la web. Agrega/quita los que necesites.
var ADMIN_EMAILS = [
  "david.zelaya698@gmail.com",
  "avid@ts.com",
  "avid0316@ts.com",
  "miguel@ts.com"
];
// Clave pública del proyecto Firebase (la misma del sitio) — sirve para validar el token.
var FIREBASE_API_KEY = "AIzaSyA9nOW0QXIdYk5MJk7wcBVrTSb-WMejOV8";

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (body.action !== "setPrecio") {
      return jsonOutput({ error: true, mensaje: "Acción no soportada: " + body.action });
    }

    var email = verificarTokenFirebase_(body.idToken);
    if (!email) {
      return jsonOutput({ error: true, mensaje: "Sesión inválida o expirada. Vuelve a iniciar sesión." });
    }
    var admins = ADMIN_EMAILS.map(function (x) { return String(x).toLowerCase(); });
    if (admins.indexOf(email.toLowerCase()) === -1) {
      return jsonOutput({ error: true, mensaje: "Tu correo (" + email + ") no está en la lista de admins." });
    }

    guardarPrecio_(body);
    return jsonOutput({ ok: true });
  } catch (err) {
    return jsonOutput({ error: true, mensaje: err.message });
  }
}

// Valida el idToken con Google/Firebase y devuelve el email verificado (o "" si no es válido).
function verificarTokenFirebase_(idToken) {
  if (!idToken) return "";
  try {
    var url = "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_API_KEY;
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    });
    var data = JSON.parse(res.getContentText() || "{}");
    if (data.users && data.users.length) return data.users[0].email || "";
  } catch (e) {}
  return "";
}

// Crea o actualiza la fila de "Precios" por Marca|Modelo|Capacidad.
function guardarPrecio_(body) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Precios");
  if (!sh) throw new Error('No existe la hoja "Precios".');

  var values = sh.getDataRange().getValues();
  var head = values[0].map(function (h) { return String(h).trim(); });
  function ci(n) { return head.indexOf(n); }
  var iMa = ci("Marca"), iMo = ci("Modelo"), iCa = ci("Capacidad"),
      iPM = ci("Precio Mayorista"), iPR = ci("Precio Reventa"), iPC = ci("Precio Cliente Final");
  if (iMa < 0 || iMo < 0 || iCa < 0) {
    throw new Error("La hoja Precios debe tener columnas Marca, Modelo y Capacidad.");
  }

  var objetivo = makeKey(body.marca, body.modelo, body.capacidad);
  var fila = -1;
  for (var r = 1; r < values.length; r++) {
    if (makeKey(values[r][iMa], values[r][iMo], values[r][iCa]) === objetivo) { fila = r; break; }
  }

  if (fila === -1) {
    var nueva = [];
    for (var k = 0; k < head.length; k++) nueva.push("");
    nueva[iMa] = body.marca || ""; nueva[iMo] = body.modelo || ""; nueva[iCa] = body.capacidad || "";
    if (iPM >= 0) nueva[iPM] = body.precioMayorista || "";
    if (iPR >= 0) nueva[iPR] = body.precioReventa || "";
    if (iPC >= 0) nueva[iPC] = body.precioPublico || "";
    sh.appendRow(nueva);
  } else {
    if (iPM >= 0) sh.getRange(fila + 1, iPM + 1).setValue(body.precioMayorista || "");
    if (iPR >= 0) sh.getRange(fila + 1, iPR + 1).setValue(body.precioReventa || "");
    if (iPC >= 0) sh.getRange(fila + 1, iPC + 1).setValue(body.precioPublico || "");
  }
}

/* ===================== MENÚ ===================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TechnologySales")
    .addItem("Construir inventario", "construirInventario")
    .addToUi();
}
