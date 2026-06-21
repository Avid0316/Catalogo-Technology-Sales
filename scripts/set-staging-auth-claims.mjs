import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = "technology-sales-staging";
const emails = [
  "admin@prueba.com",
  "asesor@prueba.com",
  "vendedor@prueba.com",
  "comisionista@prueba.com",
  "mayorista@prueba.com",
  "revendedor@prueba.com",
  "cliente@prueba.com",
];

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const auth = getAuth();
let failed = false;

for (const email of emails) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, {
      ...(user.customClaims || {}),
      role: "authenticated",
    });
    console.log(`OK ${email}`);
  } catch (error) {
    failed = true;
    console.error(`ERROR ${email}: ${error.message}`);
  }
}

if (failed) process.exitCode = 1;
else console.log("Claims de staging asignados correctamente.");

