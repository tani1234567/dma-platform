import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { sendWelcomeEmail } from "@/lib/brevo/emails";

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
}

interface CreateAgentBody {
  name: string;
  email: string;
  password: string;
}

// ─── GET /api/company/agents ──────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "company_admin")
    return errRes("forbidden", "Company admin access required.", 403);

  try {
    const agentsSnap = await adminDb
      .collection("users")
      .where("role", "==", "field_agent")
      .where("companyId", "==", claims.uid)
      .get();

    const agents = agentsSnap.docs.map((d) => {
      const u = d.data() as AgentUserDoc;
      return {
        uid:      d.id,
        name:     u.displayName,
        email:    u.email,
        isActive: u.isActive !== false,
      };
    });

    return Response.json({ agents });
  } catch (error) {
    console.error("[company/agents GET]", error);
    return Response.json({ error: "server_error", message: "Failed to fetch agents." }, { status: 500 });
  }
}

// ─── POST /api/company/agents ─────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "company_admin")
    return errRes("forbidden", "Company admin access required.", 403);

  let body: CreateAgentBody;
  try { body = (await request.json()) as CreateAgentBody; }
  catch { return errRes("bad_request", "Invalid request body.", 400); }

  const { name, email, password } = body;
  if (!name?.trim() || !email?.trim() || !password)
    return errRes("bad_request", "name, email, and password are required.", 400);
  if (password.length < 8)
    return errRes("bad_request", "Password must be at least 8 characters.", 400);

  const companyId = claims.uid;
  const companySnap = await adminDb.collection("companies").doc(companyId).get();
  if (!companySnap.exists) return errRes("not_found", "Company not found.", 404);
  const companyName = (companySnap.data() as { name: string }).name;

  try {
    const authUser = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });

    await adminAuth.setCustomUserClaims(authUser.uid, { role: "field_agent", companyId });

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

    sendWelcomeEmail({
      toEmail:   email,
      toName:    name,
      companyName,
      loginLink: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.swifora.com"}/login`,
    }).catch((err: unknown) => console.error("[company/agents] Welcome email failed:", err));

    return Response.json({ success: true, uid: authUser.uid });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create agent.";
    console.error("[company/agents POST]", error);
    return Response.json({ error: "server_error", message: msg }, { status: 500 });
  }
}
