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

// ─── PATCH /api/admin/agents/[uid] — revoke or restore access ─────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
): Promise<Response> {
  const sessionUid = request.cookies.get("__session")?.value;
  const claimsRaw  = request.cookies.get("__claims")?.value;
  if (!sessionUid || !claimsRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(claimsRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  const { uid } = await params;

  let body: { isActive: boolean };
  try { body = (await request.json()) as { isActive: boolean }; }
  catch { return errRes("bad_request", "Invalid request body.", 400); }

  if (typeof body.isActive !== "boolean")
    return errRes("bad_request", "isActive must be a boolean.", 400);

  try {
    await Promise.all([
      // Disable / enable in Firebase Auth
      adminAuth.updateUser(uid, { disabled: !body.isActive }),
      // Update Firestore user doc
      adminDb.collection("users").doc(uid).update({
        isActive:  body.isActive,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ]);

    return Response.json({
      success:  true,
      isActive: body.isActive,
      message:  body.isActive ? "Agent access restored." : "Agent access revoked.",
    });
  } catch (error) {
    console.error("[admin/agents/[uid] PATCH]", error);
    return Response.json({ error: "server_error", message: "Failed to update agent." }, { status: 500 });
  }
}
