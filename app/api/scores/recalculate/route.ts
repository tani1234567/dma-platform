import { type NextRequest } from "next/server";
import { runScoringPipeline } from "@/lib/scoring/pipeline";

export const dynamic = "force-dynamic";

// ─── Local types ──────────────────────────────────────────────────────────────

interface RecalculateBody {
  companyId: string;
  fyId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function parseClaims(raw: string): { role: string; uid: string } | null {
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString()) as {
      role: string;
      uid: string;
    };
  } catch {
    return null;
  }
}

// ─── POST /api/scores/recalculate ─────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const sessionUid = request.cookies.get("__session")?.value;
    const claimsRaw = request.cookies.get("__claims")?.value;

    if (!sessionUid || !claimsRaw) {
      return errRes("unauthorized", "Authentication required.", 401);
    }

    const claims = parseClaims(claimsRaw);
    if (!claims || claims.role !== "company_admin") {
      return errRes("forbidden", "Company admin access required.", 403);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: RecalculateBody;
    try {
      body = (await request.json()) as RecalculateBody;
    } catch {
      return errRes("bad_request", "Invalid request body.", 400);
    }

    const { companyId, fyId } = body;

    if (!companyId || !fyId) {
      return errRes("bad_request", "companyId and fyId are required.", 400);
    }

    if (claims.uid !== companyId) {
      return errRes("forbidden", "Access denied for this company.", 403);
    }

    // ── Run pipeline ──────────────────────────────────────────────────────────
    const { topicsScored, totalResponses } = await runScoringPipeline(companyId, fyId);

    console.log(
      `[scores/recalculate] company=${companyId} fy=${fyId} topics=${topicsScored} responses=${totalResponses}`
    );

    return Response.json({ success: true, topicsScored, totalResponses });
  } catch (error) {
    console.error("[scores/recalculate POST]", error);
    return Response.json(
      { error: "server_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
