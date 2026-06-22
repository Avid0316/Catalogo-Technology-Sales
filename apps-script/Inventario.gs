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

  var nuevasVariantesPrecio = 0;
  var errorPrecios = "";
  try {
    nuevasVariantesPrecio = agregarVariantesFaltantesPrecios_(ss);
  } catch (e) {
    errorPrecios = e.message || String(e);
  }

  var msg = "Inventario construido: " + (salida.length - 1) + " filas con stock.";
  if (nuevasVariantesPrecio > 0) {
    msg += "\n" + nuevasVariantesPrecio + " variantes nuevas agregadas a la hoja 'Precios'.";
  }
  if (errorPrecios) msg += "\nPrecios pendientes de preparar: " + errorPrecios;
  if (movs > 0) msg += "\n📦 " + movs + " movimientos registrados en la hoja 'Movimientos'.";
  if (desc > 0) msg += "\n⚠️ " + desc + " equipos descuadran con el sistema (revisa la hoja 'Descuadres').";
  if (sinModelo.length) {
    msg += "\n\n⚠️ " + sinModelo.length + " productos sin modelo en el diccionario (ejemplos):\n- " +
           sinModelo.slice(0, 10).join("\n- ");
  }

  // Sincroniza a Supabase automáticamente si la propiedad privada está configurada.
  try {
    if (!errorPrecios && getSupabaseServiceKey_()) {
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
  return jsonOutput({
    ok: true,
    servicio: "Technology Sales",
    estado: "activo",
    catalogoPublico: "Supabase catalogo_publico",
    datos: "Este endpoint ya no publica inventario, precios ni identificadores."
  });
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

var PRICE_HEADERS = [
  "Marca", "Modelo", "Capacidad", "Chip", "Estado",
  "Precio Mayorista", "Precio Reventa", "Precio Cliente Final"
];

function validarEncabezadosPrecios_(sheet) {
  if (!sheet) throw new Error('No existe la hoja "Precios".');
  var current = sheet.getRange(1, 1, 1, PRICE_HEADERS.length).getValues()[0];
  var errors = [];
  PRICE_HEADERS.forEach(function (expected, index) {
    if (String(current[index] || "").trim() !== expected) {
      errors.push("columna " + (index + 1) + ': "' + expected + '"');
    }
  });
  if (errors.length) {
    throw new Error(
      'La fila 1 de "Precios" no es válida. Faltan o cambiaron: ' +
      errors.join(", ") +
      '. Ejecuta "Preparar hoja de precios" antes de sincronizar.'
    );
  }
}

function leerPreciosCrudos_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, PRICE_HEADERS.length).getValues();
  return values.map(function (row) {
    return {
      marca: row[0] || "",
      modelo: row[1] || "",
      capacidad: row[2] || "",
      chip: row[3] || "",
      estado: row[4] || "",
      precioMayorista: row[5],
      precioReventa: row[6],
      precioPublico: row[7]
    };
  }).filter(function (row) {
    return String(row.modelo || "").trim();
  });
}

function tienePrecio_(row) {
  return !!row && (
    sbNum_(row.precioMayorista) !== null ||
    sbNum_(row.precioReventa) !== null ||
    sbNum_(row.precioPublico) !== null
  );
}

function leerPreciosSupabase_() {
  var serviceKey = getSupabaseServiceKey_();
  if (!serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_KEY. No se puede preparar Precios sin comprobar los valores ya publicados."
    );
  }
  var url = SUPABASE_URL +
    "/rest/v1/precios?select=marca,modelo,capacidad,chip,estado," +
    "precio_mayorista,precio_reventa,precio_publico&limit=10000";
  var res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: sbHeaders_(),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error("No se pudieron leer los precios actuales de Supabase: " + res.getContentText());
  }
  var rows = JSON.parse(res.getContentText() || "[]");
  return rows.map(function (row) {
    return {
      marca: row.marca || "",
      modelo: row.modelo || "",
      capacidad: row.capacidad || "",
      chip: row.chip || "",
      estado: row.estado || "",
      precioMayorista: row.precio_mayorista,
      precioReventa: row.precio_reventa,
      precioPublico: row.precio_publico
    };
  });
}

function variantesVigentes_(ss) {
  var out = {};
  function agregar(row) {
    var modelo = String(row["Modelo"] || "").trim();
    if (!modelo) return;
    var item = {
      marca: row["Marca"] || "",
      modelo: modelo,
      capacidad: row["Capacidad"] || "",
      chip: row["Chip"] || "",
      estado: row["Estado"] || ""
    };
    out[makeKey(item.marca, item.modelo, item.capacidad, item.chip, item.estado)] = item;
  }
  var inv = ss.getSheetByName("Inventario");
  var equipos = ss.getSheetByName("Equipos");
  if (!inv) throw new Error('No existe la hoja "Inventario".');
  sheetToObjects(inv).forEach(agregar);
  if (equipos) sheetToObjects(equipos).forEach(agregar);
  return Object.keys(out).map(function (key) { return out[key]; }).sort(function (a, b) {
    return makeKey(a.marca, a.modelo, a.capacidad, a.chip, a.estado)
      .localeCompare(makeKey(b.marca, b.modelo, b.capacidad, b.chip, b.estado));
  });
}

function agregarVariantesFaltantesPrecios_(ss) {
  var sheet = ss.getSheetByName("Precios");
  validarEncabezadosPrecios_(sheet);
  var existing = {};
  leerPreciosCrudos_(sheet).forEach(function (row) {
    existing[makeKey(row.marca, row.modelo, row.capacidad, row.chip, row.estado)] = true;
  });
  var rows = [];
  variantesVigentes_(ss).forEach(function (item) {
    var key = makeKey(item.marca, item.modelo, item.capacidad, item.chip, item.estado);
    if (existing[key]) return;
    rows.push([item.marca, item.modelo, item.capacidad, item.chip, item.estado, "", "", ""]);
    existing[key] = true;
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, PRICE_HEADERS.length).setValues(rows);
  }
  return rows.length;
}

function prepararHojaPrecios() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    "Preparar hoja de precios",
    "Se creará un respaldo y Precios se reconstruirá con las variantes vigentes de Inventario. " +
    "Solo se conservarán importes cuando Marca, Modelo, Capacidad, Chip y Estado coincidan exactamente.",
    ui.ButtonSet.OK_CANCEL
  );
  if (answer !== ui.Button.OK) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Precios");
  if (!sheet) sheet = ss.insertSheet("Precios");
  var oldRows = leerPreciosCrudos_(sheet);
  var publishedRows = leerPreciosSupabase_();
  var oldByKey = {};
  oldRows.forEach(function (row) {
    oldByKey[makeKey(row.marca, row.modelo, row.capacidad, row.chip, row.estado)] = row;
  });
  publishedRows.forEach(function (row) {
    var key = makeKey(row.marca, row.modelo, row.capacidad, row.chip, row.estado);
    if (!tienePrecio_(oldByKey[key]) && tienePrecio_(row)) oldByKey[key] = row;
  });

  if (sheet.getLastRow() > 0 || sheet.getLastColumn() > 0) {
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
    sheet.copyTo(ss).setName("Precios respaldo " + stamp);
  }

  var variants = variantesVigentes_(ss);
  var kept = 0;
  var rows = variants.map(function (item) {
    var old = oldByKey[makeKey(item.marca, item.modelo, item.capacidad, item.chip, item.estado)];
    if (tienePrecio_(old)) kept++;
    return [
      item.marca, item.modelo, item.capacidad, item.chip, item.estado,
      old ? old.precioMayorista : "",
      old ? old.precioReventa : "",
      old ? old.precioPublico : ""
    ];
  });

  sheet.clear();
  sheet.getRange(1, 1, 1, PRICE_HEADERS.length).setValues([PRICE_HEADERS]);
  if (rows.length) sheet.getRange(2, 1, rows.length, PRICE_HEADERS.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, PRICE_HEADERS.length);
  sheet.getRange(1, 1, 1, PRICE_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#0f172a")
    .setFontColor("#ffffff");

  notificar_(
    "✅ Hoja Precios preparada:\n" +
    "• " + rows.length + " variantes vigentes\n" +
    "• " + kept + " precios conservados por coincidencia exacta\n" +
    "• Respaldo creado antes del cambio"
  );
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
// 👇 Asesores de ventas que TAMBIÉN pueden editar fotos y ver el historial
//    (además de los admins). Agrega aquí sus correos.
var ASESOR_EMAILS = [
  "wilmer@ts.com"
];
// Clave pública del proyecto Firebase (la misma del sitio) — sirve para validar el token.
var FIREBASE_API_KEY = "AIzaSyA9nOW0QXIdYk5MJk7wcBVrTSb-WMejOV8";

function esAdmin_(email) {
  return ADMIN_EMAILS.map(function (x) { return String(x).toLowerCase(); }).indexOf(String(email).toLowerCase()) !== -1;
}
function puedeEditarFotos_(email) {
  var lista = ADMIN_EMAILS.concat(ASESOR_EMAILS).map(function (x) { return String(x).toLowerCase(); });
  return lista.indexOf(String(email).toLowerCase()) !== -1;
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var email = verificarTokenFirebase_(body.idToken);
    if (!email) return jsonOutput({ error: true, mensaje: "Sesión inválida o expirada. Vuelve a iniciar sesión." });

    if (body.action === "setPrecio") {
      if (!esAdmin_(email)) return jsonOutput({ error: true, mensaje: "Tu correo (" + email + ") no está en la lista de admins." });
      guardarPrecio_(body);
      try { sincronizarPreciosSupabase_(); } catch (e2) { Logger.log("Sync precios: " + e2); }
      registrar_(email, "Precio", [body.marca, body.modelo, body.capacidad].filter(String).join(" "),
        "May " + (body.precioMayorista || "-") + " · Rev " + (body.precioReventa || "-") + " · Pub " + (body.precioPublico || "-"));
      return jsonOutput({ ok: true });
    }

    if (body.action === "setFoto") {
      if (!puedeEditarFotos_(email)) return jsonOutput({ error: true, mensaje: "Tu correo (" + email + ") no puede editar fotos." });
      var url = guardarFoto_(body);
      registrar_(email, "Foto", [body.marca, body.modelo].filter(String).join(" "), "Actualizó la foto del producto");
      return jsonOutput({ ok: true, url: url });
    }

    if (body.action === "getHistorial") {
      if (!puedeEditarFotos_(email)) return jsonOutput({ error: true, mensaje: "No autorizado." });
      return jsonOutput({ ok: true, registros: leerHistorial_() });
    }

    if (body.action === "setUserAccess") {
      if (!esAdmin_(email)) return jsonOutput({ error: true, mensaje: "Solo un administrador puede cambiar accesos." });
      sincronizarAccesoUsuario_(body.email, body.role, body.name);
      registrar_(email, "Acceso", body.email || "", "Rol actualizado a " + (body.role || "cliente"));
      return jsonOutput({ ok: true });
    }

    if (body.action === "deleteUserAccess") {
      if (!esAdmin_(email)) return jsonOutput({ error: true, mensaje: "Solo un administrador puede retirar accesos." });
      eliminarAccesoUsuario_(body.email);
      registrar_(email, "Acceso", body.email || "", "Acceso retirado");
      return jsonOutput({ ok: true });
    }

    return jsonOutput({ error: true, mensaje: "Acción no soportada: " + body.action });
  } catch (err) {
    return jsonOutput({ error: true, mensaje: err.message });
  }
}

/* ===================================================================
 * FOTOS — sube la imagen a Supabase Storage y la enlaza al modelo
 * =================================================================== */
function guardarFoto_(body) {
  var serviceKey = getSupabaseServiceKey_();
  if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_KEY en las propiedades del script.");
  if (!body.dataB64) throw new Error("No se recibió la imagen.");
  var bytes = Utilities.base64Decode(body.dataB64);
  var mime = body.mime || "image/jpeg";
  var ext = mime.indexOf("png") !== -1 ? "png" : (mime.indexOf("webp") !== -1 ? "webp" : "jpg");
  var slug = (String(body.marca || "") + "-" + String(body.modelo || "")).toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "producto";
  var nombre = slug + "-" + Date.now() + "." + ext;

  var up = UrlFetchApp.fetch(SUPABASE_URL + "/storage/v1/object/productos/" + nombre, {
    method: "post", contentType: mime, payload: bytes, muteHttpExceptions: true,
    headers: { "Authorization": "Bearer " + serviceKey, "apikey": serviceKey, "x-upsert": "true" }
  });
  if (up.getResponseCode() >= 300) throw new Error("Storage " + up.getResponseCode() + ": " + up.getContentText());
  var publicUrl = SUPABASE_URL + "/storage/v1/object/public/productos/" + nombre;

  guardarImagenHoja_(body.marca, body.modelo, publicUrl);     // hoja Imagenes (upsert por Marca|Modelo)
  actualizarImagenSupabase_(body.marca, body.modelo, publicUrl); // inventario de Supabase (al instante)
  return publicUrl;
}

function guardarImagenHoja_(marca, modelo, url) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Imagenes");
  if (!sh) { sh = ss.insertSheet("Imagenes"); sh.appendRow(["Marca", "Modelo", "Imagen"]); sh.setFrozenRows(1); }
  var values = sh.getDataRange().getValues();
  var head = values[0].map(function (h) { return String(h).trim(); });
  var iMa = head.indexOf("Marca"), iMo = head.indexOf("Modelo"), iIm = head.indexOf("Imagen");
  if (iMa < 0) iMa = 0; if (iMo < 0) iMo = 1;
  if (iIm < 0) { iIm = head.length; sh.getRange(1, iIm + 1).setValue("Imagen"); }
  var key = makeKeyModelo(marca, modelo), fila = -1;
  for (var r = 1; r < values.length; r++) {
    if (makeKeyModelo(values[r][iMa], values[r][iMo]) === key) { fila = r; break; }
  }
  if (fila === -1) {
    var nueva = []; for (var k = 0; k <= iIm; k++) nueva.push("");
    nueva[iMa] = marca || ""; nueva[iMo] = modelo || ""; nueva[iIm] = url || "";
    sh.appendRow(nueva);
  } else {
    sh.getRange(fila + 1, iIm + 1).setValue(url || "");
  }
}

function actualizarImagenSupabase_(marca, modelo, url) {
  var serviceKey = getSupabaseServiceKey_();
  if (!serviceKey) return;
  var q = "?marca=eq." + encodeURIComponent(marca) + "&modelo=eq." + encodeURIComponent(modelo);
  var res = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/inventario" + q, {
    method: "patch", payload: JSON.stringify({ imagen: url }), muteHttpExceptions: true,
    headers: { "Authorization": "Bearer " + serviceKey, "apikey": serviceKey, "Content-Type": "application/json", "Prefer": "return=minimal" }
  });
  if (res.getResponseCode() >= 300) Logger.log("PATCH imagen: " + res.getContentText());
}

/* ===================================================================
 * HISTORIAL / AUDITORÍA — registro de cambios (hoja "Registro")
 * =================================================================== */
function registrar_(usuario, accion, producto, detalle) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName("Registro");
    if (!sh) { sh = ss.insertSheet("Registro"); sh.appendRow(["Fecha", "Usuario", "Accion", "Producto", "Detalle"]); sh.setFrozenRows(1); }
    // Guarda la FECHA REAL (objeto Date), no texto, para no perder la zona horaria.
    sh.appendRow([new Date(), usuario || "", accion || "", producto || "", detalle || ""]);
  } catch (e) { Logger.log("registrar_: " + e); }
}

function leerHistorial_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Registro");
  if (!sh) return [];
  return sheetToObjects(sh).reverse().slice(0, 300);  // más reciente primero, máx 300
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
  validarEncabezadosPrecios_(sh);

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

// La clave service_role vive en:
// Apps Script → Configuración del proyecto → Propiedades del script
// Nombre: SUPABASE_SERVICE_KEY
function getSupabaseServiceKey_() {
  return String(
    PropertiesService.getScriptProperties().getProperty("SUPABASE_SERVICE_KEY") || ""
  ).trim();
}

function sbNum_(v) { if (v === "" || v == null) return null; var n = Number(v); return isNaN(n) ? null : n; }
function sbInt_(v) { if (v === "" || v == null) return null; var n = parseInt(v, 10); return isNaN(n) ? null : n; }

function sbHeaders_() {
  var serviceKey = getSupabaseServiceKey_();
  if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_KEY en las propiedades del script.");
  return {
    "apikey": serviceKey,
    "Authorization": "Bearer " + serviceKey,
    "Content-Type": "application/json"
  };
}

function sbRpc_(nombre, payload) {
  var res = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/rpc/" + nombre, {
    method: "post",
    headers: sbHeaders_(),
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error("RPC " + nombre + " " + res.getResponseCode() + ": " + res.getContentText());
  }
}

function sbDeleteByEmail_(tabla, email) {
  var res = UrlFetchApp.fetch(
    SUPABASE_URL + "/rest/v1/" + tabla + "?email=eq." + encodeURIComponent(email),
    {
      method: "delete",
      headers: sbHeaders_(),
      muteHttpExceptions: true
    }
  );
  if (res.getResponseCode() >= 300) {
    throw new Error("DELETE " + tabla + " " + res.getResponseCode() + ": " + res.getContentText());
  }
}

function sbUpsert_(tabla, body) {
  var headers = sbHeaders_();
  headers["Prefer"] = "resolution=merge-duplicates,return=minimal";
  var res = UrlFetchApp.fetch(
    SUPABASE_URL + "/rest/v1/" + tabla + "?on_conflict=email",
    {
      method: "post",
      headers: headers,
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    }
  );
  if (res.getResponseCode() >= 300) {
    throw new Error("UPSERT " + tabla + " " + res.getResponseCode() + ": " + res.getContentText());
  }
}

function sincronizarAccesoUsuario_(userEmail, role, name) {
  var cleanEmail = String(userEmail || "").trim().toLowerCase();
  var cleanRole = String(role || "cliente").trim().toLowerCase();
  if (!cleanEmail) throw new Error("Falta el correo del usuario.");

  var internos = ["admin", "asesor", "vendedor"];
  var comerciales = ["cliente", "revendedor", "mayorista", "comisionista"];
  if (internos.indexOf(cleanRole) !== -1) {
    sbUpsert_("internos", {
      email: cleanEmail,
      nombre: String(name || cleanEmail),
      rol: cleanRole
    });
    sbDeleteByEmail_("catalogo_accesos", cleanEmail);
    return;
  }

  if (comerciales.indexOf(cleanRole) === -1) cleanRole = "cliente";
  sbUpsert_("catalogo_accesos", {
    email: cleanEmail,
    rol: cleanRole,
    activo: true,
    actualizado_en: new Date().toISOString()
  });
  sbDeleteByEmail_("internos", cleanEmail);
}

function eliminarAccesoUsuario_(userEmail) {
  var cleanEmail = String(userEmail || "").trim().toLowerCase();
  if (!cleanEmail) throw new Error("Falta el correo del usuario.");
  sbDeleteByEmail_("catalogo_accesos", cleanEmail);
  sbDeleteByEmail_("internos", cleanEmail);
}

function crearPreciosPayload_() {
  var prcSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Precios");
  validarEncabezadosPrecios_(prcSh);
  var prcPayload = [];
  sheetToObjects(prcSh).forEach(function (p) {
    if (!String(p["Modelo"] || "").trim()) return;
    var may = sbNum_(p["Precio Mayorista"]);
    var rev = sbNum_(p["Precio Reventa"]);
    var pub = sbNum_(p["Precio Cliente Final"]);
    if (may === null && rev === null && pub === null) return;
    prcPayload.push({
      marca: p["Marca"] || "",
      modelo: p["Modelo"] || "",
      capacidad: p["Capacidad"] || "",
      chip: p["Chip"] || "",
      estado: p["Estado"] || "",
      precio_mayorista: may,
      precio_reventa: rev,
      precio_publico: pub
    });
  });
  if (prcSh.getLastRow() > 1 && prcPayload.length === 0) {
    throw new Error(
      'La hoja "Precios" contiene variantes, pero ninguna tiene importes válidos. ' +
      "Se canceló la sincronización para no vaciar los precios de Supabase."
    );
  }
  return prcPayload;
}

function sincronizarSupabase() {
  if (!getSupabaseServiceKey_()) {
    throw new Error("Falta SUPABASE_SERVICE_KEY en las propiedades del script.");
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

  // Reemplazo total atómico: inventario y precios cambian juntos o no cambia nada.
  var prcPayload = crearPreciosPayload_();
  sbRpc_("replace_catalog_data", {
    inventory_rows: invPayload,
    price_rows: prcPayload
  });
  var nPrc = prcPayload.length;

  notificar_("✅ Sincronizado a Supabase:\n• " + invPayload.length + " productos (inventario + individuales)\n• " + nPrc + " precios con valor");
}

// Refresca SOLO la tabla de precios en Supabase (rápido). Se usa al guardar un
// precio desde la web, para que el cambio se vea al instante sin sincronizar todo.
function sincronizarPreciosSupabase_() {
  if (!getSupabaseServiceKey_()) return 0;
  var prcPayload = crearPreciosPayload_();
  sbRpc_("replace_prices", { price_rows: prcPayload });
  return prcPayload.length;
}

/* ===================== MENÚ ===================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TechnologySales")
    .addItem("Construir inventario", "construirInventario")
    .addItem("Preparar hoja de precios", "prepararHojaPrecios")
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
