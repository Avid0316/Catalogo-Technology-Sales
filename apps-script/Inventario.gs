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

    // Chip: 1° lo definido en el diccionario (columna Chip); si está vacío, lo que se detecte del nombre.
    var chip = (fm[4] && String(fm[4]).trim()) ? String(fm[4]).trim() : detectarChip_(nombre);

    salida.push([
      fm[3] || "",                  // Categoria
      fm[1] || "",                  // Marca
      fm[2] || "",                  // Modelo
      fa ? (fa[1] || "") : "",      // Capacidad
      fc ? (fc[1] || "") : "",      // Color
      chip,                         // Chip
      String(row[iSuc] || "").trim(),
      virt, cons, comp,
      disp,                         // Cantidad = Disponible
      String(row[iGru] || "").trim(),
      nombre
    ]);
  }

  // Detectar y registrar movimientos ANTES de sobrescribir el Inventario.
  var movs = 0;
  try { movs = registrarMovimientos_(ss, salida); } catch (e) { Logger.log("Movimientos: " + e); }

  var inv = ss.getSheetByName("Inventario") || ss.insertSheet("Inventario");
  inv.clearContents();
  inv.getRange(1, 1, salida.length, salida[0].length).setValues(salida);
  inv.setFrozenRows(1);

  var desc = 0;
  try { desc = revisarDescuadres_(ss); } catch (e) { Logger.log("Descuadres: " + e); }

  var msg = "Inventario construido: " + (salida.length - 1) + " filas con stock.";
  if (movs > 0) msg += "\n📦 " + movs + " movimientos registrados en la hoja 'Movimientos'.";
  if (desc > 0) msg += "\n⚠️ " + desc + " equipos descuadran con el sistema (revisa la hoja 'Descuadres').";
  if (sinModelo.length) {
    msg += "\n\n⚠️ " + sinModelo.length + " productos sin modelo en el diccionario (ejemplos):\n- " +
           sinModelo.slice(0, 10).join("\n- ");
  }

  // Sincroniza a Supabase automáticamente (solo si ya pegaste la clave service_role).
  try {
    if (SUPABASE_SERVICE_KEY && SUPABASE_SERVICE_KEY.indexOf("PEGA") === -1) {
      sincronizarSupabase();
      msg += "\n☁️ Sincronizado a Supabase.";
    }
  } catch (e) { msg += "\n⚠️ No se pudo sincronizar a Supabase: " + e.message; }

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
 * MOVIMIENTOS — historial de cambios de sucursal (hoja "Movimientos")
 * Compara el estado anterior con el nuevo y registra los cambios.
 * =================================================================== */

function stockKey_(o) {
  var p = [o["Marca"], o["Modelo"], o["Capacidad"], o["Color"], o["Chip"], o["Estado"]];
  for (var i = 0; i < p.length; i++) p[i] = String(p[i] == null ? "" : p[i]).trim().toUpperCase();
  if (!p[1]) return "";
  return p.join("|");
}

function guardarSnapEquipos_(ss, eqRows) {
  var snap = ss.getSheetByName("_SnapEquipos") || ss.insertSheet("_SnapEquipos");
  snap.clearContents();
  var rows = [["IMEI", "Sucursal"]];
  eqRows.forEach(function (e) {
    var i = String(e["IMEI"] || e["Serie"] || "").trim();
    if (i) rows.push([i, String(e["Sucursal"] || "").trim()]);
  });
  snap.getRange(1, 1, rows.length, 2).setValues(rows);
  try { snap.hideSheet(); } catch (e) {}
}

// Devuelve cuántos movimientos registró.
function registrarMovimientos_(ss, salida) {
  var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Tegucigalpa", "yyyy-MM-dd HH:mm");
  var nuevos = [];

  // 1) STOCK NORMAL: Inventario viejo vs nuevo
  var invVieja = ss.getSheetByName("Inventario");
  if (invVieja) {
    var oldRows = sheetToObjects(invVieja);
    if (oldRows.length > 0) {
      var oldMap = {}, info = {};
      oldRows.forEach(function (o) {
        var vk = stockKey_(o); if (!vk) return;
        if (!oldMap[vk]) oldMap[vk] = {};
        var s = String(o["Sucursal"] || "").trim();
        oldMap[vk][s] = (oldMap[vk][s] || 0) + (Number(o["Cantidad"]) || 0);
        info[vk] = o;
      });
      var H = salida[0];
      var iM = H.indexOf("Marca"), iMo = H.indexOf("Modelo"), iCa = H.indexOf("Capacidad"),
          iCo = H.indexOf("Color"), iCh = H.indexOf("Chip"), iSu = H.indexOf("Sucursal"),
          iCt = H.indexOf("Cantidad"), iEs = H.indexOf("Estado");
      var newMap = {};
      for (var r = 1; r < salida.length; r++) {
        var row = salida[r];
        var o2 = { Marca: row[iM], Modelo: row[iMo], Capacidad: row[iCa], Color: row[iCo], Chip: row[iCh], Estado: row[iEs] };
        var vk2 = stockKey_(o2); if (!vk2) continue;
        if (!newMap[vk2]) newMap[vk2] = {};
        var s2 = String(row[iSu] || "").trim();
        newMap[vk2][s2] = (newMap[vk2][s2] || 0) + (Number(row[iCt]) || 0);
        if (!info[vk2]) info[vk2] = o2;
      }
      var vks = {};
      Object.keys(oldMap).forEach(function (k) { vks[k] = 1; });
      Object.keys(newMap).forEach(function (k) { vks[k] = 1; });
      Object.keys(vks).forEach(function (vk) {
        var ob = oldMap[vk] || {}, nb = newMap[vk] || {}, sucs = {};
        Object.keys(ob).forEach(function (s) { sucs[s] = 1; });
        Object.keys(nb).forEach(function (s) { sucs[s] = 1; });
        var totalOld = 0, totalNew = 0, deltas = [];
        Object.keys(sucs).forEach(function (s) {
          var oq = ob[s] || 0, nq = nb[s] || 0; totalOld += oq; totalNew += nq;
          if (nq - oq !== 0) deltas.push({ s: s, d: nq - oq });
        });
        if (!deltas.length) return;
        var tipo = (totalOld === totalNew) ? "Movimiento" : "Cambio";
        var f = info[vk] || {};
        deltas.forEach(function (d) {
          nuevos.push([hoy, tipo, "", f.Modelo || "", f.Capacidad || "", f.Color || "", f.Chip || "", f.Estado || "", d.s, "", "", (d.d > 0 ? "+" : "") + d.d]);
        });
      });
    }
  }

  // 2) INDIVIDUALES (IMEI): Equipos vs snapshot
  var eqSh = ss.getSheetByName("Equipos");
  if (eqSh) {
    var eqRows = sheetToObjects(eqSh);
    var snap = ss.getSheetByName("_SnapEquipos");
    if (snap) {
      var ahora = {}, infoEq = {};
      eqRows.forEach(function (e) {
        var i = String(e["IMEI"] || e["Serie"] || "").trim(); if (!i) return;
        ahora[i] = String(e["Sucursal"] || "").trim(); infoEq[i] = e;
      });
      var antes = {};
      sheetToObjects(snap).forEach(function (s) {
        var i = String(s["IMEI"] || "").trim(); if (i) antes[i] = String(s["Sucursal"] || "").trim();
      });
      Object.keys(ahora).forEach(function (imei) {
        var e = infoEq[imei];
        if (!(imei in antes)) {
          nuevos.push([hoy, "Ingreso", imei, e["Modelo"] || "", e["Capacidad"] || "", e["Color"] || "", e["Chip"] || "", e["Estado"] || "", "", "", ahora[imei], ""]);
        } else if (antes[imei] !== ahora[imei]) {
          nuevos.push([hoy, "Individual", imei, e["Modelo"] || "", e["Capacidad"] || "", e["Color"] || "", e["Chip"] || "", e["Estado"] || "", "", antes[imei], ahora[imei], ""]);
        }
      });
      Object.keys(antes).forEach(function (imei) {
        if (!(imei in ahora)) nuevos.push([hoy, "Salida", imei, "", "", "", "", "", "", antes[imei], "", ""]);
      });
    }
    guardarSnapEquipos_(ss, eqRows);
  }

  if (!nuevos.length) return 0;
  var mv = ss.getSheetByName("Movimientos");
  if (!mv) {
    mv = ss.insertSheet("Movimientos");
    mv.appendRow(["Fecha", "Tipo", "IMEI", "Modelo", "Capacidad", "Color", "Chip", "Estado", "Sucursal", "Desde", "Hacia", "Cambio"]);
    mv.setFrozenRows(1);
  }
  mv.getRange(mv.getLastRow() + 1, 1, nuevos.length, 12).setValues(nuevos);
  return nuevos.length;
}

/* ===================================================================
 * DESCUADRES — equipos individuales que no concuerdan con el sistema
 * (ej. están en la hoja "Equipos" pero el sistema ya no los tiene en
 *  esa sucursal: probablemente se vendieron o movieron sin actualizar).
 * =================================================================== */
function revisarDescuadres_(ss) {
  var eqSh = ss.getSheetByName("Equipos");
  var invSh = ss.getSheetByName("Inventario");
  if (!eqSh || !invSh) return 0;

  function k3(mo, ca, su) {
    return [String(mo || "").trim().toUpperCase(), String(ca || "").trim().toUpperCase(), String(su || "").trim().toUpperCase()].join("|");
  }
  // Stock físico del sistema por Modelo|Capacidad|Sucursal (Virtual+Consig+Comprometido)
  var sys = {};
  sheetToObjects(invSh).forEach(function (o) {
    var k = k3(o["Modelo"], o["Capacidad"], o["Sucursal"]);
    var fis = (Number(o["CantidadVirtual"]) || 0) + (Number(o["CantidadConsignacion"]) || 0) + (Number(o["Comprometido"]) || 0);
    sys[k] = (sys[k] || 0) + fis;
  });
  // Conteo de equipos individuales por Modelo|Capacidad|Sucursal
  var eqc = {}, info = {};
  sheetToObjects(eqSh).forEach(function (e) {
    if (!String(e["Modelo"] || "").trim()) return;
    var k = k3(e["Modelo"], e["Capacidad"], e["Sucursal"]);
    eqc[k] = (eqc[k] || 0) + 1; info[k] = e;
  });

  var desc = [];
  Object.keys(eqc).forEach(function (k) {
    var enEq = eqc[k], enSys = sys[k] || 0;
    if (enEq > enSys) {
      var e = info[k];
      desc.push([e["Modelo"] || "", e["Capacidad"] || "", e["Sucursal"] || "", enEq, enSys, enEq - enSys]);
    }
  });

  var d = ss.getSheetByName("Descuadres") || ss.insertSheet("Descuadres");
  d.clearContents();
  d.getRange(1, 1, 1, 6).setValues([["Modelo", "Capacidad", "Sucursal", "En Equipos", "En Sistema", "Descuadre"]]);
  d.setFrozenRows(1);
  if (desc.length) d.getRange(2, 1, desc.length, 6).setValues(desc);
  return desc.length;
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

    // Imágenes generales por modelo (hoja opcional "Imagenes": Marca · Modelo · Imagen)
    var imagenesSheet = ss.getSheetByName("Imagenes");
    var imagenes = imagenesSheet ? sheetToObjects(imagenesSheet) : [];
    var imagenesMap = {};
    imagenes.forEach(function (item) {
      imagenesMap[makeKeyModelo(item["Marca"], item["Modelo"])] = item["Imagen"] || "";
    });

    // Mapa de precios por Marca|Modelo|Capacidad
    var preciosMap = {};
    precios.forEach(function (item) {
      var key = makeKey(item["Marca"], item["Modelo"], item["Capacidad"], item["Chip"], item["Estado"]);
      preciosMap[key] = {
        precioMayorista:    formatLempiras(item["Precio Mayorista"]),
        precioReventa:      formatLempiras(item["Precio Reventa"]),
        precioClienteFinal: formatLempiras(item["Precio Cliente Final"]),
        imagen:             item["Imagen"] || ""
      };
    });

    var resultado = inventario.map(function (item) {
      var key = makeKey(item["Marca"], item["Modelo"], item["Capacidad"], item["Chip"], item["Estado"]);
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
        // Imagen general por modelo (hoja Imagenes); si no hay, cae a la de Precios.
        Imagen: imagenesMap[makeKeyModelo(item["Marca"], item["Modelo"])] || p.imagen || ""
      };
    });

    // Equipos individuales (hoja "Equipos"): cada teléfono con su ficha y precio propio.
    resultado = resultado.concat(leerEquipos_(ss, imagenesMap));

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

function makeKey(marca, modelo, capacidad, chip, estado) {
  return [marca || "", modelo || "", capacidad || "", chip || "", estado || ""]
    .map(function (v) { return String(v).trim().toUpperCase(); })
    .join("|");
}

// Llave general por Marca + Modelo (para la imagen del modelo, sin capacidad).
function makeKeyModelo(marca, modelo) {
  return [marca || "", modelo || ""]
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

// Lee la hoja "Equipos" (venta por unidad): cada fila es un teléfono con su
// ficha (batería, ciclos, garantía) y su precio propio. Categoría fija.
function leerEquipos_(ss, imagenesMap) {
  var sh = ss.getSheetByName("Equipos");
  if (!sh) return [];
  var filas = sheetToObjects(sh);
  var out = [];
  filas.forEach(function (e) {
    if (!String(e["Modelo"] || "").trim()) return;   // salta filas vacías
    var marca = e["Marca"] || "", modelo = e["Modelo"] || "";
    out.push({
      Categoria:    "Equipos individuales",
      Marca:        marca,
      Modelo:       modelo,
      Capacidad:    e["Capacidad"] || "",
      Color:        e["Color"] || "",
      Chip:         e["Chip"] || "",
      Sucursal:     e["Sucursal"] || "",
      Cantidad:     1,
      Consignacion: 0,
      Comprometido: 0,
      Estado:       e["Estado"] || "",
      "Precio Mayorista": formatLempiras(e["Precio Mayorista"]),
      "Precio Reventa":   formatLempiras(e["Precio Reventa"]),
      "Precio Publico":   formatLempiras(e["Precio Cliente Final"]),
      Imagen:       e["Imagen"] || (imagenesMap ? (imagenesMap[makeKeyModelo(marca, modelo)] || "") : ""),
      // Campos propios del equipo individual:
      Individual:   true,
      IMEI:         e["IMEI"] || e["Serie"] || "",
      Bateria:      e["Bateria"] || e["Batería"] || "",
      Ciclos:       e["Ciclos"] || "",
      Garantia:     e["Garantia"] || e["Garantía"] || "",
      Vence:        fmtFecha_(e["Vence"] || e["Vence Garantia"] || e["Vence Garantía"] || "")
    });
  });
  return out;
}

// Da formato a la fecha de garantía: si es una fecha real → "MM/AAAA"; si no, texto tal cual.
function fmtFecha_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || "America/Tegucigalpa", "MM/yyyy");
  }
  return String(v || "").trim();
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
  var iMa = ci("Marca"), iMo = ci("Modelo"), iCa = ci("Capacidad"), iCh = ci("Chip"), iEs = ci("Estado"),
      iPM = ci("Precio Mayorista"), iPR = ci("Precio Reventa"), iPC = ci("Precio Cliente Final");
  if (iMa < 0 || iMo < 0 || iCa < 0) {
    throw new Error("La hoja Precios debe tener columnas Marca, Modelo y Capacidad.");
  }

  var objetivo = makeKey(body.marca, body.modelo, body.capacidad, body.chip, body.estado);
  var fila = -1;
  for (var r = 1; r < values.length; r++) {
    var chipFila = iCh >= 0 ? values[r][iCh] : "";
    var estFila = iEs >= 0 ? values[r][iEs] : "";
    if (makeKey(values[r][iMa], values[r][iMo], values[r][iCa], chipFila, estFila) === objetivo) { fila = r; break; }
  }

  if (fila === -1) {
    var nueva = [];
    for (var k = 0; k < head.length; k++) nueva.push("");
    nueva[iMa] = body.marca || ""; nueva[iMo] = body.modelo || ""; nueva[iCa] = body.capacidad || "";
    if (iCh >= 0) nueva[iCh] = body.chip || "";
    if (iEs >= 0) nueva[iEs] = body.estado || "";
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

/* ===================================================================
 * PARTE 4 — SINCRONIZAR A SUPABASE  (Sheet → Supabase)
 * Empuja Inventario + Equipos (individuales) + Precios a las tablas de
 * Supabase para que la web lea de ahí (rápida). Reemplazo total.
 * =================================================================== */

// ⚙️ CONFIG SUPABASE
var SUPABASE_URL = "https://heeaqlzuqraxnrspnzat.supabase.co";
// ⚠️ SECRETA: pega aquí tu clave "service_role" (Settings ▸ API Keys).
//    NO la compartas con nadie ni la pongas en la página web.
var SUPABASE_SERVICE_KEY = "PEGA_AQUI_TU_SERVICE_ROLE";

function sbNum_(v) { if (v === "" || v == null) return null; var n = Number(v); return isNaN(n) ? null : n; }
function sbInt_(v) { if (v === "" || v == null) return null; var n = parseInt(v, 10); return isNaN(n) ? null : n; }

function sbHeaders_() {
  return {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
    "Content-Type": "application/json"
  };
}

// Borra TODAS las filas de una tabla (id es bigint > 0).
function sbDeleteAll_(tabla) {
  var res = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/" + tabla + "?id=gte.0", {
    method: "delete", headers: sbHeaders_(), muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error("DELETE " + tabla + " " + res.getResponseCode() + ": " + res.getContentText());
}

// Inserta en lotes de 500.
function sbInsert_(tabla, filas) {
  for (var i = 0; i < filas.length; i += 500) {
    var lote = filas.slice(i, i + 500);
    var h = sbHeaders_(); h["Prefer"] = "return=minimal";
    var res = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/" + tabla, {
      method: "post", headers: h, payload: JSON.stringify(lote), muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 300) throw new Error("INSERT " + tabla + " " + res.getResponseCode() + ": " + res.getContentText());
  }
}

function sincronizarSupabase() {
  if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY.indexOf("PEGA") !== -1) {
    throw new Error("Falta pegar tu clave service_role en SUPABASE_SERVICE_KEY.");
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var invSh = ss.getSheetByName("Inventario");
  var prcSh = ss.getSheetByName("Precios");
  var eqSh = ss.getSheetByName("Equipos");
  var imgSh = ss.getSheetByName("Imagenes");
  if (!invSh || !prcSh) throw new Error("Faltan las hojas Inventario o Precios.");

  // Imágenes por Marca|Modelo
  var imagenesMap = {};
  if (imgSh) sheetToObjects(imgSh).forEach(function (it) {
    imagenesMap[makeKeyModelo(it["Marca"], it["Modelo"])] = it["Imagen"] || "";
  });

  // inventario: productos normales
  var invPayload = [];
  sheetToObjects(invSh).forEach(function (o) {
    if (!String(o["Modelo"] || "").trim()) return;
    invPayload.push({
      categoria: o["Categoria"] || "", marca: o["Marca"] || "", modelo: o["Modelo"] || "",
      capacidad: o["Capacidad"] || "", color: o["Color"] || "", chip: o["Chip"] || "",
      sucursal: o["Sucursal"] || "",
      cantidad: sbInt_(o["Cantidad"]) || 0, consignacion: sbInt_(o["CantidadConsignacion"]) || 0,
      comprometido: sbInt_(o["Comprometido"]) || 0, estado: o["Estado"] || "",
      imagen: imagenesMap[makeKeyModelo(o["Marca"], o["Modelo"])] || "", individual: false,
      imei: "", bateria: null, ciclos: null, garantia: "", vence: ""
    });
  });

  // inventario: individuales (hoja Equipos)
  if (eqSh) sheetToObjects(eqSh).forEach(function (e) {
    if (!String(e["Modelo"] || "").trim()) return;
    invPayload.push({
      categoria: "Equipos individuales", marca: e["Marca"] || "", modelo: e["Modelo"] || "",
      capacidad: e["Capacidad"] || "", color: e["Color"] || "", chip: e["Chip"] || "",
      sucursal: e["Sucursal"] || "", cantidad: 1, consignacion: 0, comprometido: 0,
      estado: e["Estado"] || "",
      imagen: e["Imagen"] || imagenesMap[makeKeyModelo(e["Marca"], e["Modelo"])] || "",
      individual: true, imei: String(e["IMEI"] || e["Serie"] || ""),
      bateria: sbInt_(e["Bateria"] || e["Batería"]), ciclos: sbInt_(e["Ciclos"]),
      garantia: e["Garantia"] || e["Garantía"] || "",
      vence: fmtFecha_(e["Vence"] || e["Vence Garantia"] || e["Vence Garantía"] || "")
    });
  });

  // precios (solo con al menos un precio)
  var prcPayload = [];
  sheetToObjects(prcSh).forEach(function (p) {
    if (!String(p["Modelo"] || "").trim()) return;
    var may = sbNum_(p["Precio Mayorista"]), rev = sbNum_(p["Precio Reventa"]), pub = sbNum_(p["Precio Cliente Final"]);
    if (may === null && rev === null && pub === null) return;
    prcPayload.push({
      marca: p["Marca"] || "", modelo: p["Modelo"] || "", capacidad: p["Capacidad"] || "",
      chip: p["Chip"] || "", estado: p["Estado"] || "",
      precio_mayorista: may, precio_reventa: rev, precio_publico: pub
    });
  });

  // Reemplazo total en Supabase
  sbDeleteAll_("inventario"); sbInsert_("inventario", invPayload);
  sbDeleteAll_("precios");    sbInsert_("precios", prcPayload);

  notificar_("✅ Sincronizado a Supabase:\n• " + invPayload.length + " productos (inventario + individuales)\n• " + prcPayload.length + " precios con valor");
}

/* ===================== MENÚ ===================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TechnologySales")
    .addItem("Construir inventario", "construirInventario")
    .addItem("Sincronizar a Supabase", "sincronizarSupabase")
    .addItem("Revisar descuadres", "revisarDescuadres")
    .addToUi();
}

// Versión de menú: revisa descuadres bajo demanda y avisa el resultado.
function revisarDescuadres() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var n = revisarDescuadres_(ss);
  notificar_(n > 0
    ? "⚠️ " + n + " equipos descuadran con el sistema. Revisa la hoja 'Descuadres'."
    : "✅ Todo cuadra: ningún equipo individual descuadra con el sistema.");
}
