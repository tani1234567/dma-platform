import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { sendWelcomeEmail } from "@/lib/brevo/emails";
import type { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}
function parseClaims(raw: string): { role: string; uid: string } | null {
  try { return JSON.parse(Buffer.from(raw, "base64").toString()) as { role: string; uid: string }; }
  catch { return null; }
}

interface AgentUserDoc {
  displayName: string;
  email: string;
  role: string;
  companyId?: string;
  isActive?: boolean;
  createdAt?: Timestamp;
}

interface CreateAgentBody {
  name: string;
  email: string;
  password: string;
  companyId: string;
}

// ─── GET /api/admin/agents ────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const sessionUid = request.cookies.get("__session")?.value;
  const claimsRaw  = request.cookies.get("__claims")?.value;
  if (!sessionUid || !claimsRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(claimsRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  try {
    const agentsSnap = await adminDb.collection("users")
      .where("role", "==", "field_agent")
      .orderBy("createdAt", "desc")
      .get();

    // Collect unique company IDs
    const companyIds = new Set<string>();
    for (const d of agentsSnap.docs) {
      const cid = (d.data() as AgentUserDoc).companyId;
      if (cid) companyIds.add(cid);
    }

    // Fetch company names
    const companyNames = new Map<string, string>();
    await Promise.all(
      Array.from(companyIds).map(async (cid) => {
        const snap = await adminDb.collection("companies").doc(cid).get();
        if (snap.exists) companyNames.set(cid, (snap.data() as { name: string }).name);
      })
    );

    const agents = agentsSnap.docs.map(d => {
      const u = d.data() as AgentUserDoc;
      return {
        uid:         d.id,
        name:        u.displayName,
        email:       u.email,
        companyId:   u.companyId ?? "",
        companyName: companyNames.get(u.companyId ?? "") ?? u.companyId ?? "—",
        isActive:    u.isActive !== false,
        createdAt:   u.createdAt?.toDate().toISOString() ?? "",
      };
    });

    return Response.json({ agents });
  } catch (error) {
    console.error("[admin/agents GET]", error);
    return Response.json({ error: "server_error", message: "Failed to fetch agents." }, { status: 500 });
  }
}

// ─── POST /api/admin/agents ───────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const sessionUid = request.cookies.get("__session")?.value;
  const claimsRaw  = request.cookies.get("__claims")?.value;
  if (!sessionUid || !claimsRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(claimsRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  let body: CreateAgentBody;
  try { body = (await request.json()) as CreateAgentBody; }
  catch { return errRes("bad_request", "Invalid request body.", 400); }

  const { name, email, password, companyId } = body;
  if (!name || !email || !password || !companyId)
    return errRes("bad_request", "name, email, password, and companyId are required.", 400);
  if (password.length < 8)
    return errRes("bad_request", "Password must be at least 8 characters.", 400);

  // Fetch company to validate and get name
  const companySnap = await adminDb.collection("companies").doc(companyId).get();
  if (!companySnap.exists) return errRes("not_found", "Company not found.", 404);
  const companyName = (companySnap.data() as { name: string }).name;

  try {
    // 1. Create Firebase Auth user
    const authUser = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });

    // 2. Set custom claims
    await adminAuth.setCustomUserClaims(authUser.uid, {
      role: "field_agent",
      companyId,
    });

    // 3. Create Firestore user doc
    await adminDb.collection("users").doc(authUser.uid).set({
      uid:                  authUser.uid,
      email,
      displayName:          name,
      role:                 "field_agent",
      companyId,
      isActive:             true,
      registrationComplete: true,
      createdAt:            FieldValue.serverTimestamp(),
      updatedAt:            FieldValue.serverTimestamp(),
    });

    // 4. Send welcome email (fire-and-forget)
    sendWelcomeEmail({
      toEmail:     email,
      toName:      name,
      companyName,
      loginLink:   `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.swifora.com"}/login`,
    }).catch((err: unknown) => console.error("[admin/agents] Welcome email failed:", err));

    return Response.json({
      success: true,
      uid:     authUser.uid,
      message: `Field agent ${name} created successfully.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create agent.";
    console.error("[admin/agents POST]", error);
    return Response.json({ error: "server_error", message: msg }, { status: 500 });
  }
}
