import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}
function parseClaims(raw: string): { role: string; uid: string } | null {
  try { return JSON.parse(Buffer.from(raw, "base64").toString()) as { role: string; uid: string }; }
  catch { return null; }
}

// ─── PATCH /api/company/agents/[uid] — suspend or restore ────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "company_admin")
    return errRes("forbidden", "Company admin access required.", 403);

  const { uid } = await params;

  let body: { isActive: boolean };
  try { body = (await request.json()) as { isActive: boolean }; }
  catch { return errRes("bad_request", "Invalid request body.", 400); }

  if (typeof body.isActive !== "boolean")
    return errRes("bad_request", "isActive must be a boolean.", 400);

  // Verify the agent actually belongs to this company
  const agentSnap = await adminDb.collection("users").doc(uid).get();
  if (!agentSnap.exists) return errRes("not_found", "Agent not found.", 404);
  const agentData = agentSnap.data() as { role: string; companyId?: string };
  if (agentData.role !== "field_agent" || agentData.companyId !== claims.uid)
    return errRes("forbidden", "This agent does not belong to your company.", 403);

  try {
    await Promise.all([
      adminAuth.updateUser(uid, { disabled: !body.isActive }),
      adminDb.collection("users").doc(uid).update({
        isActive:  body.isActive,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ]);

    return Response.json({
      success:  true,
      isActive: body.isActive,
      message:  body.isActive ? "Agent access restored." : "Agent suspended.",
    });
  } catch (error) {
    console.error("[company/agents/[uid] PATCH]", error);
    return Response.json({ error: "server_error", message: "Failed to update agent." }, { status: 500 });
  }
}
