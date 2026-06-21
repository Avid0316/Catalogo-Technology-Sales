import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "technology-sales-staging";
const users = [
  { email: "admin@prueba.com", name: "Admin Pruebas", role: "admin" },
  { email: "asesor@prueba.com", name: "Asesor Pruebas", role: "asesor" },
  { email: "vendedor@prueba.com", name: "Vendedor Pruebas", role: "vendedor" },
  { email: "comisionista@prueba.com", name: "Comisionista Pruebas", role: "comisionista" },
  { email: "mayorista@prueba.com", name: "Mayorista Pruebas", role: "mayorista" },
  { email: "revendedor@prueba.com", name: "Revendedor Pruebas", role: "revendedor" },
  { email: "cliente@prueba.com", name: "Cliente Pruebas", role: "cliente" },
];

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const auth = getAuth();
const db = getFirestore();
let failed = false;

for (const profile of users) {
  try {
    const user = await auth.getUserByEmail(profile.email);
    await auth.setCustomUserClaims(user.uid, {
      ...(user.customClaims || {}),
      role: "authenticated",
    });
    await db.collection("usuarios").doc(profile.email).set({
      name: profile.name,
      role: profile.role,
    }, { merge: true });
    console.log(`OK ${profile.email} -> ${profile.role}`);
  } catch (error) {
    failed = true;
    console.error(`ERROR ${profile.email}: ${error.message}`);
  }
}

if (failed) process.exitCode = 1;
else console.log("Claims y perfiles de staging asignados correctamente.");
