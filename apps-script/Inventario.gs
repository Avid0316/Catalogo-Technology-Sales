/***********************************************************************
 * TechnologySales · Catálogo de Inventario
 * -------------------------------------------------------------------
 * PASO 1 — Normaliza el reporte del sistema (INVENTARIO_GENERAL) y lo
 * entrega como JSON limpio para el sitio web.
 *
 * Qué hace:
 *   - Lee la hoja con el reporte crudo del sistema (pegado tal cual).
 *   - Separa Modelo / Almacenamiento / RAM / Color / Chip del nombre.
 *   - Toma Categoría (Subgrupo), Marca (Referencia) y Estado (Grupo).
 *   - Calcula el stock:
 *        Disponible   = Cantidad Virtual + Cantidad Consignación
 *        Comprometido = lo que está en proforma (solo personal interno)
 *   - Entrega una fila por (producto + sucursal) con disponible > 0
 *     o comprometido > 0 (los agotados NO se envían).
 *
 * Cómo se usa:
 *   1. Pega el reporte del sistema en la hoja "Inventario crudo".
 *   2. Menú  TechnologySales ▸ Reconstruir catálogo  (para previsualizar).
 *   3. Publica como App Web (Implementar ▸ Nueva implementación).
 *   Ver apps-script/INSTRUCCIONES.md para el paso a paso.
 ***********************************************************************/

/** ====== CONFIGURACIÓN ====== **/
var CFG = {
  // Nombre de la hoja donde pegas el reporte del sistema.
  // Si no existe, se busca automáticamente la hoja que tenga la columna "NombreProducto".
  RAW_SHEET: 'Inventario crudo',
  // Hoja donde se escribe el catálogo limpio (para que lo puedas revisar).
  CATALOG_SHEET: 'Catalogo',
  // Encabezados esperados del reporte del sistema (tal como vienen).
  COLS: {
    codigo:      'Producto',
    marca:       'Referencia',
    nombre:      'NombreProducto',
    sucursal:    'NombreSucursal',
    subgrupo:    'NombreSubgrupoProducto',
    grupo:       'NombreGrupoProducto',
    consignacion:'CantidadConsignacion',
    comprometido:'Comprometido',
    virtual:     'CantidadVirtual'
  }
};

/** ====== DICCIONARIOS DE EXTRACCIÓN ====== **/
// Colores (los compuestos van primero para que ganen sobre los simples).
var COLORS = [
  'GRIS TITANIO','TITANIO NATURAL','TITANIO DESIERTO','NATURAL TITANIUM',
  'AZUL OSCURO','AZUL CLARO','VERDE OSCURO','VERDE CLARO','ULTRAMARINO','ULTRAMAR',
  'NEGRO','BLANCO','AZUL','VERDE','GRIS','DORADO','MORADO','ROJO','ROSADO','ROSA',
  'PLATA','SILVER','TITANIO','AMARILLO','CELESTE','BEIGE','CAFE','NARANJA','LILA',
  'MENTA','CREMA','ORO','GRAFITO','MEDIANOCHE','DESERT','DESIERTO','NATURAL','CORAL',
  'BRONCE','AURA','TEAL','TURQUESA','FUCSIA','VINO','LAVANDA','DURAZNO','OLIVA',
  'OBSIDIANA','MARFIL','PERLA','ARENA','ESTELAR','NEGRA','BLANCA'
];
var CAP_RE  = /(\d+\s*(?:GB|TB))(?:\s*\/\s*(\d+\s*RAM))?/i;
var CHIP_RE = /(DUAL\s*SIM|DUALSIM|2\s*SIM|1\s*SIM|E\s*SIM|ESIM|FISICO)/i;

function normChip_(x) {
  x = String(x).toUpperCase().replace(/\s+/g, '');
  if (x === 'DUALSIM' || x === '2SIM') return 'Dual SIM';
  if (x === '1SIM') return '1 SIM';
  if (x === 'ESIM') return 'eSIM';
  if (x === 'FISICO') return 'SIM física';
  return '';
}

function titleCase_(s) {
  return String(s).toLowerCase().replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); });
}

/**
 * Separa un nombre crudo en: modelo, capacidad, ram, color, chip.
 * Ej: "HOT 40 PRO 64GB/3RAM VERDE" -> {model:"HOT 40 PRO", cap:"64GB", ram:"3RAM", color:"Verde", chip:""}
 */
function parseName_(name) {
  var s = ' ' + String(name || '').toUpperCase().trim() + ' ';
  var chip = '', cap = '', ram = '', color = '';

  var mChip = s.match(CHIP_RE);
  if (mChip) { chip = normChip_(mChip[1]); s = s.replace(mChip[0], ' '); }

  var mCap = s.match(CAP_RE);
  if (mCap) {
    cap = mCap[1].replace(/\s+/g, '');
    if (mCap[2]) ram = mCap[2].replace(/\s+/g, '');
    s = s.replace(mCap[0], ' ');
  }

  for (var i = 0; i < COLORS.length; i++) {
    var c = COLORS[i];
    if (s.indexOf(' ' + c + ' ') !== -1) { color = titleCase_(c); s = s.replace(' ' + c + ' ', ' '); break; }
  }

  var model = s.replace(/\s+/g, ' ').trim();
  return { model: model, cap: cap, ram: ram, color: color, chip: chip };
}

/** ====== LECTURA DE LA HOJA CRUDA ====== **/
function getRawSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG.RAW_SHEET);
  if (sh) return sh;
  // Búsqueda automática: la hoja que tenga "NombreProducto" en alguna fila.
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var vals = sheets[i].getDataRange().getValues();
    for (var r = 0; r < Math.min(vals.length, 10); r++) {
      if (vals[r].indexOf(CFG.COLS.nombre) !== -1) return sheets[i];
    }
  }
  throw new Error('No encontré la hoja del reporte. Crea una hoja llamada "' + CFG.RAW_SHEET + '" y pega ahí el reporte del sistema.');
}

// Localiza la fila de encabezados y devuelve un mapa nombre->índice de columna.
function headerMap_(values) {
  for (var r = 0; r < Math.min(values.length, 10); r++) {
    if (values[r].indexOf(CFG.COLS.nombre) !== -1) {
      var map = {}, row = values[r];
      for (var c = 0; c < row.length; c++) map[String(row[c]).trim()] = c;
      return { headerRow: r, map: map };
    }
  }
  throw new Error('No encontré la fila de encabezados (debe incluir la columna "' + CFG.COLS.nombre + '").');
}

function num_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }

/**
 * Construye el catálogo limpio a partir del reporte crudo.
 * Devuelve un arreglo de objetos { ...campos del sitio... }.
 */
function buildCatalog_() {
  var sh = getRawSheet_();
  var values = sh.getDataRange().getValues();
  var hm = headerMap_(values);
  var map = hm.map, C = CFG.COLS;

  function idx(key) {
    var name = C[key], i = map[name];
    if (i === undefined) throw new Error('Falta la columna "' + name + '" en el reporte.');
    return i;
  }
  var iCod = idx('codigo'), iMarca = idx('marca'), iNom = idx('nombre'),
      iSuc = idx('sucursal'), iSub = idx('subgrupo'), iGru = idx('grupo'),
      iCons = idx('consignacion'), iComp = idx('comprometido'), iVirt = idx('virtual');

  var parsedCache = {}; // código -> atributos (parseo una sola vez por código)
  var out = [];

  for (var r = hm.headerRow + 1; r < values.length; r++) {
    var row = values[r];
    var code = row[iCod];
    if (code === '' || code === null) continue;

    var disp = num_(row[iVirt]) + num_(row[iCons]);
    var comp = num_(row[iComp]);
    if (disp <= 0 && comp <= 0) continue; // agotados: no se envían

    var p = parsedCache[code];
    if (!p) { p = parseName_(row[iNom]); parsedCache[code] = p; }

    out.push({
      'Categoria':       titleCase_(row[iSub] || ''),
      'Marca':           titleCase_(row[iMarca] || ''),
      'Modelo':          p.model,
      'Capacidad':       p.cap,
      'RAM':             p.ram,
      'Color':           p.color,
      'Chip':            p.chip,
      'Sucursal':        String(row[iSuc] || '').trim(),
      'Cantidad':        disp,          // Disponible (Virtual + Consignación)
      'Comprometido':    comp,          // Solo personal interno
      'Estado':          titleCase_(row[iGru] || ''),
      'Precio Mayorista':'',            // Se llenan en el Paso 2 (hoja Precios)
      'Precio Reventa':  '',
      'Precio Publico':  '',
      'Imagen':          '',
      'Codigo':          code           // llave para unir con Precios (Paso 2)
    });
  }
  return out;
}

/** ====== PUNTO DE ENTRADA WEB (lo que consume el sitio) ====== **/
function doGet(e) {
  var data;
  try {
    data = buildCatalog_();
  } catch (err) {
    data = { error: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** ====== HERRAMIENTAS PARA TI (menú en la hoja) ====== **/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TechnologySales')
    .addItem('Reconstruir catálogo', 'reconstruirCatalogo')
    .addToUi();
}

/** Escribe el catálogo limpio en la hoja "Catalogo" para que lo revises. */
function reconstruirCatalogo() {
  var data = buildCatalog_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG.CATALOG_SHEET) || ss.insertSheet(CFG.CATALOG_SHEET);
  sh.clearContents();

  var headers = ['Categoria','Marca','Modelo','Capacidad','RAM','Color','Chip',
                 'Sucursal','Cantidad','Comprometido','Estado',
                 'Precio Mayorista','Precio Reventa','Precio Publico','Imagen','Codigo'];
  var rows = [headers];
  for (var i = 0; i < data.length; i++) {
    var d = data[i], line = [];
    for (var h = 0; h < headers.length; h++) line.push(d[headers[h]]);
    rows.push(line);
  }
  sh.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sh.setFrozenRows(1);
  SpreadsheetApp.getUi().alert('Catálogo reconstruido: ' + data.length + ' filas con stock.');
}
