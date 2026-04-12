/**
 * scripts/seedGRITopics.ts
 *
 * Seeds GRI topics from data/gri_topics_seed.json into Firestore /gri_topics
 * and optionally creates/promotes a super admin user.
 *
 * Usage:
 *   npm run seed:topics
 *
 * Requires .env.local with:
 *   FIREBASE_SERVICE_ACCOUNT_KEY  (JSON string)  — OR —
 *   GOOGLE_APPLICATION_CREDENTIALS (path to JSON file)
 *   SUPER_ADMIN_EMAIL             (optional)
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as admin from "firebase-admin";

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// Load .env.local (falls back to .env if .env.local is absent)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✓ Loaded .env.local");
} else {
  dotenv.config();
  console.log("⚠  .env.local not found — using process environment");
}

// ─── Firebase Admin init ──────────────────────────────────────────────────────

function initAdmin(): void {
  if (admin.apps.length) return;

  const keyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyEnv) {
    try {
      const serviceAccount = JSON.parse(keyEnv);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "swifora",
        storageBucket: "swifora.firebasestorage.app",
      });
      console.log("✓ Firebase Admin initialised from FIREBASE_SERVICE_ACCOUNT_KEY");
      return;
    } catch {
      console.error("✗ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY — must be valid JSON");
      process.exit(1);
    }
  }

  // Fall back to Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS env var)
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "swifora",
    storageBucket: "swifora.firebasestorage.app",
  });
  console.log("✓ Firebase Admin initialised via Application Default Credentials");
}

// ─── Types matching JSON seed file ────────────────────────────────────────────

interface RawQuestion {
  id: string;
  text: string;
}

interface RawTopic {
  code: string;           // "E1"
  pillar: string;         // "Environmental"
  pillarCode: string;     // "E"
  topic: string;          // Human-readable name
  description: string;
  griReference: string;   // "GRI 305"
  questions: RawQuestion[];
}

// ─── Seed GRI Topics ──────────────────────────────────────────────────────────

async function seedGRITopics(db: admin.firestore.Firestore): Promise<void> {
  // Resolve seed file — prefer /data/, fall back to project root
  const candidates = [
    path.resolve(process.cwd(), "data", "gri_topics_seed.json"),
    path.resolve(process.cwd(), "gri_topics_seed.json"),
  ];

  const seedFile = candidates.find((p) => fs.existsSync(p));
  if (!seedFile) {
    console.error(
      "✗ Seed file not found. Expected at:\n  " + candidates.join("\n  ")
    );
    process.exit(1);
  }

  console.log(`\n📄 Reading seed file: ${path.relative(process.cwd(), seedFile)}`);
  const raw: RawTopic[] = JSON.parse(fs.readFileSync(seedFile, "utf-8"));
  console.log(`   Found ${raw.length} topics`);

  // Firestore allows max 500 operations per batch
  const BATCH_SIZE = 400;
  let written = 0;
  let batchNum = 0;

  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    batchNum++;
    const chunk = raw.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const topic of chunk) {
      const pillarLower = topic.pillar.toLowerCase() as
        | "environmental"
        | "social"
        | "governance";

      const docRef = db.collection("gri_topics").doc(topic.code);

      batch.set(
        docRef,
        {
          id: topic.code,
          code: topic.code,
          name: topic.topic,
          pillar: pillarLower,
          pillarCode: topic.pillarCode,
          description: topic.description,
          griReference: topic.griReference,
          questions: topic.questions,
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: false } // always overwrite on re-run
      );

      process.stdout.write(
        `   [batch ${batchNum}] Writing ${topic.code} — ${topic.topic}\n`
      );
      written++;
    }

    await batch.commit();
    console.log(`   ✓ Batch ${batchNum} committed (${chunk.length} topics)`);
  }

  console.log(`\n✅ GRI topics seeded — ${written}/${raw.length} documents written`);
}

// ─── Seed Super Admin ─────────────────────────────────────────────────────────

async function seedSuperAdmin(
  db: admin.firestore.Firestore,
  authAdmin: admin.auth.Auth
): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  if (!email) {
    console.log(
      "\n⚠  SUPER_ADMIN_EMAIL not set — skipping super admin seeding.\n" +
        "   Add SUPER_ADMIN_EMAIL=you@example.com to .env.local and re-run."
    );
    return;
  }

  console.log(`\n👤 Seeding super admin: ${email}`);

  let uid: string;

  // Try to find existing user
  try {
    const existing = await authAdmin.getUserByEmail(email);
    uid = existing.uid;
    console.log(`   Found existing Auth user — UID: ${uid}`);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;

    if (code !== "auth/user-not-found") {
      console.error("   ✗ Firebase Auth error:", err);
      process.exit(1);
    }

    // Create a new Auth account with a secure random password
    const tempPassword = crypto.randomUUID().replace(/-/g, "") + "Aa1!";
    const created = await authAdmin.createUser({
      email,
      password: tempPassword,
      displayName: "Super Admin",
      emailVerified: false,
    });
    uid = created.uid;
    console.log(`   ✓ Created new Auth user — UID: ${uid}`);
    console.log(
      `   ⚠  Temporary password set. Send a password-reset email:\n` +
        `     firebase auth:export → or run resetPassword("${email}") from the app`
    );
  }

  // Set custom claims  { role: "super_admin" }
  await authAdmin.setCustomUserClaims(uid, { role: "super_admin" });
  console.log(`   ✓ Custom claim set: { role: "super_admin" }`);

  // Upsert Firestore user document
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        uid,
        email,
        displayName: "Super Admin",
        role: "super_admin",
        registrationComplete: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true } // preserve existing fields (e.g. displayName if user updated it)
    );

  console.log(`   ✓ Firestore /users/${uid} upserted`);
  console.log(
    `\n✅ Super admin ready. UID: ${uid}\n` +
      `   Note: existing sessions won't pick up the new claim until the user's\n` +
      `   ID token is refreshed (sign out → sign in, or wait ~1 hour).`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════");
  console.log("  Swifora DMA — Seed Script");
  console.log("═══════════════════════════════════════════\n");

  initAdmin();

  const db = admin.firestore();
  const authAdmin = admin.auth();

  await seedGRITopics(db);
  await seedSuperAdmin(db, authAdmin);

  console.log("\n═══════════════════════════════════════════");
  console.log("  Done.");
  console.log("═══════════════════════════════════════════\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Seed script failed:", err);
  process.exit(1);
});
