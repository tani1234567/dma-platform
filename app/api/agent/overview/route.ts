import { type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import type { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}
function parseClaims(raw: string): { role: string; uid: string } | null {
  try { return JSON.parse(Buffer.from(raw, "base64").toString()) as { role: string; uid: string }; }
  catch { return null; }
}

async function getAgentCompanyId(uid: string): Promise<string | null> {
  const snap = await adminDb.collection("users").doc(uid).get();
  return (snap.data()?.companyId as string | undefined) ?? null;
}

export async function GET(request: NextRequest): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "field_agent") return errRes("forbidden", "Field agent access required.", 403);

  const companyId = await getAgentCompanyId(claims.uid);
  if (!companyId) return errRes("not_found", "No company assigned to this agent.", 404);

  try {
    const companySnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companySnap.exists) return errRes("not_found", "Company not found.", 404);
    const companyData = companySnap.data() as { name: string; industry?: string };

    // Get most recent non-draft assessment
    const assessmentsSnap = await adminDb
      .collection("companies").doc(companyId)
      .collection("assessments")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const activeDoc = assessmentsSnap.docs.find(d => {
      const s = (d.data() as { status?: string }).status;
      return s && s !== "draft";
    });

    if (!activeDoc) {
      return Response.json({
        company: { id: companyId, name: companyData.name, industry: companyData.industry ?? "" },
        assessment: null,
        stats: null,
      });
    }

    const aData = activeDoc.data() as {
      financialYear: string;
      status: string;
      launchedAt?: Timestamp;
    };

    const [stakeholdersSnap, totalResponsesSnap, agentResponsesSnap] = await Promise.all([
      adminDb.collection("companies").doc(companyId)
        .collection("assessments").doc(activeDoc.id)
        .collection("stakeholders").count().get(),
      adminDb.collection("companies").doc(companyId)
        .collection("assessments").doc(activeDoc.id)
        .collection("responses").count().get(),
      adminDb.collection("companies").doc(companyId)
        .collection("assessments").doc(activeDoc.id)
        .collection("responses")
        .where("proxyAgentUid", "==", claims.uid)
        .count().get(),
    ]);

    const total     = stakeholdersSnap.data().count;
    const completed = totalResponsesSnap.data().count;
    const byAgent   = agentResponsesSnap.data().count;

    return Response.json({
      company:    { id: companyId, name: companyData.name, industry: companyData.industry ?? "" },
      assessment: {
        id: activeDoc.id,
        financialYear: aData.financialYear,
        status: aData.status,
        launchedAt: aData.launchedAt?.toDate().toISOString() ?? null,
      },
      stats: {
        total,
        completed,
        pending:  total - completed,
        byAgent,
      },
    });
  } catch (error) {
    console.error("[agent/overview GET]", error);
    return Response.json({ error: "server_error", message: "Failed to load overview." }, { status: 500 });
  }
}
