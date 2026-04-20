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

interface SurveyQuestion { id: string; text: string; }

interface PatchTopicBody {
  isActive?: boolean;
  description?: string;
  griReference?: string;
  questions?: SurveyQuestion[];
}

// ─── Helper: resolve topic doc ref by code ────────────────────────────────────

async function resolveTopicRef(code: string) {
  const directRef = adminDb.collection("gri_topics").doc(code);
  const directSnap = await directRef.get();
  if (directSnap.exists) return { ref: directRef, snap: directSnap };
  const q = await adminDb.collection("gri_topics").where("code", "==", code).limit(1).get();
  if (q.empty) return null;
  return { ref: q.docs[0].ref, snap: q.docs[0] };
}

// ─── GET /api/admin/topics/[code] — fetch single topic with full questions ────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  const { code } = await params;

  try {
    const result = await resolveTopicRef(code);
    if (!result) return errRes("not_found", "Topic not found.", 404);

    const data = result.snap.data() as Record<string, unknown>;
    return Response.json({
      topic: {
        id:           result.snap.id,
        code:         data.code        ?? code,
        name:         data.name        ?? "",
        pillar:       data.pillar      ?? "",
        pillarCode:   data.pillarCode  ?? "",
        griReference: data.griReference ?? "",
        description:  data.description ?? "",
        questions:    (data.questions as SurveyQuestion[]) ?? [],
        isActive:     data.isActive    !== false,
      },
    });
  } catch (error) {
    console.error("[admin/topics/[code] GET]", error);
    return Response.json({ error: "server_error", message: "Failed to fetch topic." }, { status: 500 });
  }
}

// ─── PATCH /api/admin/topics/[code] — edit fields or replace questions ────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  const { code } = await params;

  let body: PatchTopicBody;
  try { body = (await request.json()) as PatchTopicBody; }
  catch { return errRes("bad_request", "Invalid request body.", 400); }

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof body.isActive === "boolean")    update.isActive    = body.isActive;
  if (typeof body.description === "string")  update.description = body.description.trim();
  if (typeof body.griReference === "string") update.griReference = body.griReference.trim();
  if (Array.isArray(body.questions)) {
    // Validate and re-index question IDs as CODE_Q1, CODE_Q2, …
    const cleaned: SurveyQuestion[] = body.questions
      .filter((q): q is SurveyQuestion => typeof q?.text === "string" && q.text.trim().length > 0)
      .map((q, i) => ({ id: `${code}_Q${i + 1}`, text: q.text.trim() }));
    update.questions = cleaned;
  }

  if (Object.keys(update).length === 1)
    return errRes("bad_request", "Nothing to update.", 400);

  try {
    const result = await resolveTopicRef(code);
    if (!result) return errRes("not_found", "Topic not found.", 404);
    await result.ref.update(update);
    return Response.json({ success: true });
  } catch (error) {
    console.error("[admin/topics/[code] PATCH]", error);
    return Response.json({ error: "server_error", message: "Failed to update topic." }, { status: 500 });
  }
}
