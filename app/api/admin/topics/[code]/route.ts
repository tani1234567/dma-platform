import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}
function parseClaims(raw: string): { role: string; uid: string } | null {
  try { return JSON.parse(Buffer.from(raw, "base64").toString()) as { role: string; uid: string }; }
  catch { return null; }
}

interface PatchTopicBody {
  isActive?: boolean;
  description?: string;
  griReference?: string;
}

// ─── PATCH /api/admin/topics/[code] — edit description/griRef or toggle active ─

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<Response> {
  const sessionUid = request.cookies.get("__session")?.value;
  const claimsRaw  = request.cookies.get("__claims")?.value;
  if (!sessionUid || !claimsRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(claimsRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  const { code } = await params;

  let body: PatchTopicBody;
  try { body = (await request.json()) as PatchTopicBody; }
  catch { return errRes("bad_request", "Invalid request body.", 400); }

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof body.isActive === "boolean")    update.isActive    = body.isActive;
  if (typeof body.description === "string")  update.description = body.description.trim();
  if (typeof body.griReference === "string") update.griReference = body.griReference.trim();

  if (Object.keys(update).length === 1)
    return errRes("bad_request", "Nothing to update.", 400);

  try {
    // Topics may be keyed by code or by auto-ID. Try by code first, then query.
    const directRef = adminDb.collection("gri_topics").doc(code);
    const directSnap = await directRef.get();

    if (directSnap.exists) {
      await directRef.update(update);
    } else {
      // Fall back: query by code field
      const q = await adminDb.collection("gri_topics").where("code", "==", code).limit(1).get();
      if (q.empty) return errRes("not_found", "Topic not found.", 404);
      await q.docs[0].ref.update(update);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[admin/topics/[code] PATCH]", error);
    return Response.json({ error: "server_error", message: "Failed to update topic." }, { status: 500 });
  }
}
