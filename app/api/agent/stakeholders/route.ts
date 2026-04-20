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

interface StakeholderDoc {
  name: string;
  email: string;
  type: string;
  weight: number;
  status: string;
  assignedTopics?: string[];
  organisation?: string;
  isProxySubmission?: boolean;
  proxyAgentUid?: string;
  createdAt?: Timestamp;
}

export async function GET(request: NextRequest): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "field_agent") return errRes("forbidden", "Field agent access required.", 403);

  const companyId = await getAgentCompanyId(claims.uid);
  if (!companyId) return errRes("not_found", "No company assigned to this agent.", 404);

  const { searchParams } = new URL(request.url);
  const assessmentId = searchParams.get("assessmentId");
  if (!assessmentId) return errRes("bad_request", "assessmentId is required.", 400);

  // Guard: assessment must belong to this company
  const assessmentSnap = await adminDb
    .collection("companies").doc(companyId)
    .collection("assessments").doc(assessmentId)
    .get();
  if (!assessmentSnap.exists) return errRes("not_found", "Assessment not found.", 404);

  try {
    const snap = await adminDb
      .collection("companies").doc(companyId)
      .collection("assessments").doc(assessmentId)
      .collection("stakeholders")
      .orderBy("createdAt", "asc")
      .get();

    const stakeholders = snap.docs.map(d => {
      const data = d.data() as StakeholderDoc;
      return {
        id:               d.id,
        name:             data.name,
        email:            data.email,
        type:             data.type,
        weight:           data.weight,
        status:           data.status,
        topicCount:       (data.assignedTopics ?? []).length,
        assignedTopics:   data.assignedTopics ?? [],
        organisation:     data.organisation ?? "",
        isProxySubmission: data.isProxySubmission ?? false,
        proxyAgentUid:    data.proxyAgentUid ?? null,
      };
    });

    return Response.json({ stakeholders });
  } catch (error) {
    console.error("[agent/stakeholders GET]", error);
    return Response.json({ error: "server_error", message: "Failed to load stakeholders." }, { status: 500 });
  }
}
