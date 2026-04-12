/**
 * scripts/testFirestoreWrite.ts
 *
 * Diagnostic script — writes a test user document to Firestore using the
 * Admin SDK (bypasses security rules) and reads it back. Confirms whether
 * Firestore is reachable and the project config is correct.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/testFirestoreWrite.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as admin from "firebase-admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── Init Admin SDK ──────────────────────────────────────────────────────────

function initAdmin() {
  if (admin.apps.length) return admin.app();

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    console.error("❌  FIREBASE_SERVICE_ACCOUNT_KEY is not set in .env.local");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(key) as admin.ServiceAccount;
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  initAdmin();
  const db = admin.firestore();

  const testDocId = `__test_${Date.now()}`;
  const testData = {
    uid: testDocId,
    email: "test@example.com",
    displayName: "",
    role: "company_admin",
    registrationComplete: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  console.log(`\n🔵  Writing test document to /users/${testDocId} …`);

  try {
    await db.collection("users").doc(testDocId).set(testData);
    console.log("✅  Write succeeded.");
  } catch (err) {
    console.error("❌  Write failed:", err);
    process.exit(1);
  }

  console.log(`\n🔵  Reading back /users/${testDocId} …`);
  try {
    const snap = await db.collection("users").doc(testDocId).get();
    if (snap.exists) {
      console.log("✅  Read succeeded. Document data:");
      console.log(JSON.stringify(snap.data(), null, 2));
    } else {
      console.error("❌  Document not found after write.");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌  Read failed:", err);
    process.exit(1);
  }

  console.log(`\n🔵  Cleaning up — deleting test document …`);
  try {
    await db.collection("users").doc(testDocId).delete();
    console.log("✅  Cleanup done.\n");
  } catch (err) {
    console.warn("⚠️   Cleanup failed (non-fatal):", err);
  }

  console.log("🟢  Firestore is reachable and working correctly.\n");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
