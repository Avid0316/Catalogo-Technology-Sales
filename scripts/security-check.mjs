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

requireMatch(
  "apps-script/Inventario.gs",
  /datos:\s*"Este endpoint ya no publica inventario/,
  "doGet no debe publicar el catálogo heredado"
);

forbidMatch(
  "apps-script/Inventario.gs",
  /SUPABASE_SERVICE_KEY\s*=\s*["']/,
  "la clave service_role no debe estar escrita en el código"
);

const html = read("index.html");
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
