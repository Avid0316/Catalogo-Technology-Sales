import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function requireMatch(file, pattern, message) {
  const text = read(file);
  if (!pattern.test(text)) failures.push(`${file}: ${message}`);
}

function forbidMatch(file, pattern, message) {
  const text = read(file);
  if (pattern.test(text)) failures.push(`${file}: ${message}`);
}

forbidMatch(
  "index.html",
  /sbFetch\(["']inventario\?select=\*/,
  "el navegador no debe leer la tabla inventario directamente"
);

forbidMatch(
  "index.html",
  /sbFetch\(["']precios\?select=\*/,
  "el navegador no debe leer la tabla precios directamente"
);

requireMatch(
  "index.html",
  /return\{role:"cliente",name:email\}/,
  "un usuario sin perfil debe degradarse a cliente"
);

requireMatch(
  "index.html",
  /if\(!saved\|\|!saved\.id\)throw new Error/,
  "la interfaz debe exigir confirmación de Firestore"
);

requireMatch(
  "index.html",
  /\["cliente","Cliente"\]/,
  "el editor de usuarios debe conservar explícitamente el rol cliente"
);

requireMatch(
  "index.html",
  /\["comisionista","Comisionista"\]/,
  "el editor de usuarios debe incluir el rol comisionista"
);

requireMatch(
  "index.html",
  /function canSeeAllPrices\(\)\{return isInternal\(\)\|\|currentRole==="comisionista"\}/,
  "el comisionista debe ver los tres precios sin convertirse en usuario interno"
);

requireMatch(
  "index.html",
  /await syncUserAccess\(email,role,name\)/,
  "los roles deben sincronizarse con las listas protegidas de Supabase"
);

requireMatch(
  "supabase_security_hardening.sql",
  /revoke all on public\.inventario from anon, authenticated/i,
  "debe revocar acceso directo al inventario"
);

requireMatch(
  "supabase_security_hardening.sql",
  /create or replace view public\.catalogo_publico/i,
  "debe existir una vista pública limitada"
);

requireMatch(
  "supabase_security_hardening.sql",
  /create or replace function public\.catalogo_comisionista\(\)/i,
  "debe existir un catálogo limitado específico para comisionistas"
);

requireMatch(
  "supabase_security_hardening.sql",
  /'•••• '\s*\|\|\s*right\(i\.imei::text,\s*4\)/i,
  "el IMEI del comisionista debe enmascararse en el servidor"
);

requireMatch(
  "supabase_staging_base.sql",
  /create table if not exists public\.inventario/i,
  "staging debe poder instalar inventario desde una base vacía"
);

requireMatch(
  "supabase_staging_seed.sql",
  /comisionista@prueba\.com/,
  "staging debe incluir cuentas ficticias para probar los roles"
);

requireMatch(
  "index.html",
  /getIdToken\(true\)/,
  "la carga protegida debe refrescar el token después de asignar claims"
);

requireMatch(
  "index.html",
  /function resetSessionUiState\(\)[\s\S]*cartStage="cart"[\s\S]*misPedidos=\[\]/,
  "el cambio de usuario debe limpiar carrito, filtros, vistas y pedidos anteriores"
);

requireMatch(
  "index.html",
  /function enterPortal\(\)\{resetSessionUiState\(\)/,
  "cada sesión debe comenzar con una interfaz limpia"
);

requireMatch(
  "index.html",
  /function logout\(\)\{resetSessionUiState\(\)/,
  "cerrar sesión debe eliminar el estado visual del usuario anterior"
);

requireMatch(
  "index.html",
  /\/storage\/v1\/object\/sign\//,
  "las fotografías internas deben mostrarse mediante URLs firmadas"
);

requireMatch(
  "index.html",
  /return `storage:\/\/\$\{bucket\}\/\$\{name\}`/,
  "la base debe guardar referencias privadas, no URLs públicas"
);

forbidMatch(
  "index.html",
  /storage\/v1\/object\/public\/\$\{bucket\}/,
  "los buckets internos no deben generar URLs públicas"
);

requireMatch(
  "index.html",
  /function deletePrivatePhoto\(ref\)[\s\S]*method:"DELETE"/,
  "los archivos privados deben poder eliminarse de Storage"
);

requireMatch(
  "index.html",
  /deletePrivatePhotos\(\[row\.foto_imei,row\.foto_garantia/,
  "eliminar un equipo debe retirar también sus fotografías"
);

requireMatch(
  "index.html",
  /deletePrivatePhotos\(\[\.\.\.\(row\.img_envio\|\|\[\]\),\.\.\.\(row\.img_recibo\|\|\[\]\)\]\)/,
  "eliminar un traslado debe retirar también sus fotografías"
);

requireMatch(
  "index.html",
  /\.ov-sheet \.sheet\{[^}]*height:min\(94dvh,760px\)[^}]*display:flex[^}]*flex-direction:column/,
  "la ficha interna debe mantener una altura estable"
);

requireMatch(
  "index.html",
  /<div class="sh-content"><div class="sh-panel on"/,
  "las pestañas deben desplazarse dentro de un área central fija"
);

requireMatch(
  "index.html",
  /const acts=isAdminRole\(\)\?eqEstadoBtn\(e\)/,
  "solo administración debe recibir controles para modificar cambios"
);

requireMatch(
  "supabase_admin_only_equipment_changes.sql",
  /for update using \(public\.is_admin\(\)\)/i,
  "Supabase debe limitar la actualización de cambios a administradores"
);

requireMatch(
  "supabase_admin_only_equipment_changes.sql",
  /for delete using \(public\.is_admin\(\)\)/i,
  "Supabase debe limitar la eliminación de cambios a administradores"
);

forbidMatch(
  "supabase_staging_seed.sql",
  /@ts\.com|technology-sales-web|avid0316/i,
  "staging no debe contener correos o identificadores reales de producción"
);

requireMatch(
  "scripts/set-staging-auth-claims.mjs",
  /role:\s*"authenticated"/,
  "el script de staging debe asignar el claim requerido por Supabase"
);

requireMatch(
  "scripts/set-staging-auth-claims.mjs",
  /collection\("usuarios"\).*doc\(profile\.email\)/s,
  "el script de staging debe crear los perfiles de rol en Firestore"
);

requireMatch(
  "index.html",
  /ENTORNO DE PRUEBAS · DATOS FICTICIOS · NO ES PRODUCCIÓN/,
  "la vista previa debe distinguirse visualmente de producción"
);

requireMatch(
  "index.html",
  /apiUrl:""\s*\}/,
  "staging no debe tener configurado el Apps Script de producción"
);

forbidMatch(
  "scripts/set-staging-auth-claims.mjs",
  /@ts\.com|avid0316/i,
  "el script de claims no debe apuntar a usuarios reales de producción"
);

requireMatch(
  "firestore.rules",
  /allow delete: if isAdmin\(\)/,
  "solo administradores deben eliminar cotizaciones"
);

requireMatch(
  "firestore.rules",
  /function canManageQuotes\(\)[\s\S]*return role\(\) in \["admin", "asesor"\]/,
  "solo admin y asesor deben gestionar la bandeja general de cotizaciones"
);

requireMatch(
  "firestore.rules",
  /allow update: if canManageQuotes\(\) && validQuoteUpdate\(\)/,
  "vendedor no debe modificar cotizaciones directamente"
);

requireMatch(
  "firestore.rules",
  /function validQuoteItem\(item\)[\s\S]*item\.cantidad is int/,
  "Firestore debe validar los campos de cada artículo cotizado"
);

requireMatch(
  "firestore.rules",
  /function validQuoteUpdate\(\)[\s\S]*changed\.hasOnly\(\[[\s\S]*"items", "totalEstimado"/,
  "las actualizaciones de cotizaciones deben limitar los campos modificables"
);

requireMatch(
  "firestore.rules",
  /!signedIn\(\)[\s\S]*cliente\.rol == "cliente"[\s\S]*cliente\.rol == role\(\)/,
  "el rol declarado en una cotización debe coincidir con la identidad"
);

forbidMatch(
  "firestore.rules",
  /return role\(\) in \[[^\]]*"comisionista"/,
  "el comisionista no debe convertirse en personal interno de Firestore"
);

forbidMatch(
  "firestore.rules",
  /allow read,\s*update,\s*delete:\s*if request\.auth != null/,
  "no se permite acceso global por el mero hecho de iniciar sesión"
);

forbidMatch(
  ".github/workflows/firebase-deploy.yml",
  /continue-on-error:\s*true/,
  "el despliegue no debe continuar si fallan las reglas de Firestore"
);

requireMatch(
  ".github/workflows/firebase-deploy.yml",
  /Desplegar reglas de Firestore[\s\S]*Desplegar a Firebase Hosting/,
  "las reglas deben publicarse antes que la aplicación"
);

forbidMatch(
  "index.html",
  /user-scalable=no|maximum-scale=1\.0|gesturestart/,
  "la aplicación no debe bloquear el zoom accesible"
);

requireMatch(
  "index.html",
  /recordId:c\.recordId\|\|""[\s\S]*chip:c\.chip\|\|""[\s\S]*sucursal:c\.sucursal\|\|""/,
  "las cotizaciones deben conservar variante, equipo individual y sucursal"
);

requireMatch(
  "index.html",
  /recordId:product\.individual\?\(product\.recordId\|\|""\):""/,
  "solo los equipos individuales deben fijar un recordId concreto"
);

requireMatch(
  "apps-script/Inventario.gs",
  /datos:\s*"Este endpoint ya no publica inventario/,
  "doGet no debe publicar el catálogo heredado"
);

requireMatch(
  "apps-script/Inventario.gs",
  /function validarEncabezadosPrecios_\(sheet\)[\s\S]*Preparar hoja de precios/,
  "la sincronización debe bloquear encabezados de precios dañados"
);

requireMatch(
  "apps-script/Inventario.gs",
  /function prepararHojaPrecios\(\)[\s\S]*sheet\.copyTo\(ss\)[\s\S]*variantesVigentes_/,
  "la conciliación de precios debe respaldar la hoja y usar variantes vigentes"
);

requireMatch(
  "apps-script/Inventario.gs",
  /function leerPreciosSupabase_\(\)[\s\S]*\/rest\/v1\/precios[\s\S]*publishedRows/,
  "la conciliación debe conservar precios que ya estén publicados en Supabase"
);

requireMatch(
  "apps-script/Inventario.gs",
  /function agregarVariantesFaltantesPrecios_\(ss\)[\s\S]*variantesVigentes_[\s\S]*setValues\(rows\)/,
  "construir inventario debe agregar variantes nuevas sin sobrescribir precios"
);

requireMatch(
  "apps-script/Inventario.gs",
  /prcPayload\.length === 0[\s\S]*no vaciar los precios de Supabase/,
  "una hoja sin importes no debe borrar precios publicados"
);

forbidMatch(
  "apps-script/Inventario.gs",
  /SUPABASE_SERVICE_KEY\s*=\s*["']/,
  "la clave service_role no debe estar escrita en el código"
);

const html = read("index.html");
const stagingConfig = html.match(
  /window\.TS_CONFIG=window\.TS_ENV==="staging"\?\{[\s\S]*?supabaseUrl:"([^"]+)",\s*supabaseKey:"([^"]+)"/
);
if (!stagingConfig) {
  failures.push("index.html: no se pudo validar la configuración de Supabase staging");
} else {
  try {
    const payload = JSON.parse(
      Buffer.from(stagingConfig[2].split(".")[1], "base64url").toString("utf8")
    );
    if (payload.iss !== "supabase" || payload.ref !== "hvubspslexrzlqpxwzwp" || payload.role !== "anon") {
      failures.push("index.html: la clave pública de Supabase staging no corresponde al proyecto configurado");
    }
  } catch {
    failures.push("index.html: la clave pública de Supabase staging no es un JWT válido");
  }
}
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
scripts.forEach((match, index) => {
  let source = match[2];
  if (match[1].includes('type="module"')) {
    source = source.replace(/^\s*import .*$/gm, "");
  }
  try {
    new vm.Script(source, { filename: `index-script-${index + 1}.js` });
  } catch (error) {
    failures.push(`index.html: JavaScript inválido: ${error.message}`);
  }
});

try {
  new vm.Script(read("apps-script/Inventario.gs"), {
    filename: "apps-script/Inventario.gs"
  });
} catch (error) {
  failures.push(`apps-script/Inventario.gs: JavaScript inválido: ${error.message}`);
}

if (failures.length) {
  console.error("Fallaron las verificaciones de seguridad:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Verificaciones de seguridad superadas.");
