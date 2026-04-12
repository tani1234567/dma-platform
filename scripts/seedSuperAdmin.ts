/**
 * scripts/seedSuperAdmin.ts
 *
 * Creates the Super Admin user in Firebase Auth and Firestore.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Requires .env.local with:
 *   FIREBASE_SERVICE_ACCOUNT_KEY  (JSON string)
 *   SUPER_ADMIN_EMAIL
 *   SUPER_ADMIN_PASSWORD
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as admin from "firebase-admin";

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✓ Loaded .env.local");
} else {
  dotenv.config();
  console.log("⚠  .env.local not found — using process environment");
}

// ─── Firebase Admin init ──────────────────────────────────────────────────────

function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0] as admin.app.App;

  const keyRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!keyRaw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set in environment.");
  }

  const credential = admin.credential.cert(
    JSON.parse(keyRaw) as admin.ServiceAccount
  );

  return admin.initializeApp({ credential });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("✗ SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env.local");
    process.exit(1);
  }

  initAdmin();
  const auth = admin.auth();
  const db = admin.firestore();

  // Check if user already exists
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`ℹ  Auth user already exists: ${uid}`);
  } catch {
    // Create new user
    const created = await auth.createUser({
      email,
      password,
      displayName: "Platform Admin",
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`✓ Created Firebase Auth user: ${uid}`);
  }

  // Set custom claims
  await auth.setCustomUserClaims(uid, { role: "super_admin" });
  console.log("✓ Set custom claim: { role: 'super_admin' }");

  // Upsert Firestore user doc
  await db.collection("users").doc(uid).set(
    {
      uid,
      email,
      displayName: "Platform Admin",
      role: "super_admin",
      isActive: true,
      registrationComplete: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`✓ Upserted Firestore doc: users/${uid}`);

  console.log(`\n✅ Super Admin ready — uid: ${uid}, email: ${email}`);
  console.log("   Log in at /login and you will be redirected to /admin.");
}

seedSuperAdmin()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("✗ seedSuperAdmin failed:", err);
    process.exit(1);
  });
