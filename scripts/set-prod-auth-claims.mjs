// =====================================================================
// Pone el custom claim role:"authenticated" a TODOS los usuarios reales
// de Firebase (producción). Sin este claim, Supabase los trata como
// anónimos y los roles internos/comerciales no pueden cargar el catálogo.
//
// Cómo ejecutarlo (Google Cloud Shell del proyecto de producción):
//   gcloud config set project technology-sales-web
//   npm install firebase-admin
//   node scripts/set-prod-auth-claims.mjs
// =====================================================================
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = "technology-sales-web"; // PRODUCCIÓN
initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();

let total = 0, ok = 0, failed = 0, pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  for (const u of page.users) {
    total++;
    try {
      await auth.setCustomUserClaims(u.uid, {
        ...(u.customClaims || {}),
        role: "authenticated",
      });
      ok++;
    } catch (e) {
      failed++;
      console.error(`ERROR ${u.email || u.uid}: ${e.message}`);
    }
  }
  pageToken = page.pageToken;
} while (pageToken);

console.log(`\nUsuarios: ${total} · claim aplicado: ${ok} · fallidos: ${failed}`);
console.log("Nota: cada usuario verá el claim al refrescar su sesión (re-login o ~1 h).");
if (failed) process.exitCode = 1;
