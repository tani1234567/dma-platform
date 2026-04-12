import { type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}
function parseClaims(raw: string): { role: string; uid: string } | null {
  try { return JSON.parse(Buffer.from(raw, "base64").toString()) as { role: string; uid: string }; }
  catch { return null; }
}

interface GRITopicDoc {
  code: string;
  name: string;
  pillarCode: string;
  griReference?: string;
  description?: string;
  isActive?: boolean;
  questions?: unknown[];
}

// ─── GET /api/admin/topics ────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const sessionUid = request.cookies.get("__session")?.value;
  const claimsRaw  = request.cookies.get("__claims")?.value;
  if (!sessionUid || !claimsRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(claimsRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  try {
    const snap = await adminDb.collection("gri_topics").orderBy("code").get();

    const topics = snap.docs.map(d => {
      const t = d.data() as GRITopicDoc;
      return {
        id:             d.id,
        code:           t.code,
        name:           t.name,
        pillarCode:     t.pillarCode,
        griReference:   t.griReference ?? "—",
        description:    t.description ?? "",
        questionsCount: Array.isArray(t.questions) ? t.questions.length : 0,
        isActive:       t.isActive !== false, // default true if field missing
      };
    });

    return Response.json({ topics });
  } catch (error) {
    console.error("[admin/topics GET]", error);
    return Response.json({ error: "server_error", message: "Failed to fetch topics." }, { status: 500 });
  }
}
