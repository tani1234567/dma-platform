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

async function getAgentCompanyId(uid: string): Promise<string | null> {
  const snap = await adminDb.collection("users").doc(uid).get();
  return (snap.data()?.companyId as string | undefined) ?? null;
}

interface SurveyQuestion { id: string; text: string; }
interface GRITopicDoc {
  code: string; name: string; pillar: string; pillarCode: string;
  description: string; griReference: string; questions: SurveyQuestion[];
}

export async function GET(request: NextRequest): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "field_agent") return errRes("forbidden", "Field agent access required.", 403);

  const companyId = await getAgentCompanyId(claims.uid);
  if (!companyId) return errRes("not_found", "No company assigned to this agent.", 404);

  const { searchParams } = new URL(request.url);
  const stakeholderId = searchParams.get("stakeholderId");
  const assessmentId  = searchParams.get("assessmentId");
  if (!stakeholderId || !assessmentId) return errRes("bad_request", "stakeholderId and assessmentId are required.", 400);

  try {
    // Verify assessment belongs to this company
    const assessmentRef = adminDb
      .collection("companies").doc(companyId)
      .collection("assessments").doc(assessmentId);
    const assessmentSnap = await assessmentRef.get();
    if (!assessmentSnap.exists) return errRes("not_found", "Assessment not found.", 404);

    // Fetch stakeholder
    const stakeholderSnap = await assessmentRef
      .collection("stakeholders").doc(stakeholderId).get();
    if (!stakeholderSnap.exists) return errRes("not_found", "Stakeholder not found.", 404);

    const s = stakeholderSnap.data() as {
      name: string; email: string; type: string; weight: number;
      status: string; assignedTopics?: string[]; organisation?: string;
      isProxySubmission?: boolean;
    };

    if (s.status === "completed") {
      return errRes("conflict", "Survey already submitted for this stakeholder.", 409);
    }

    const assignedTopics: string[] = s.assignedTopics ?? [];
    if (assignedTopics.length === 0) {
      return errRes("bad_request", "No topics assigned to this stakeholder.", 400);
    }

    // Fetch GRI topics for assigned codes — batch by 10 (Firestore in-query limit)
    const topicsMap = new Map<string, GRITopicDoc & { id: string }>();

    for (let i = 0; i < assignedTopics.length; i += 10) {
      const batch = assignedTopics.slice(i, i + 10);
      // Try by document ID first
      const directDocs = await Promise.all(
        batch.map(code => adminDb.collection("gri_topics").doc(code).get())
      );
      const missingCodes: string[] = [];
      for (let j = 0; j < directDocs.length; j++) {
        if (directDocs[j].exists) {
          topicsMap.set(batch[j], { id: directDocs[j].id, ...directDocs[j].data() as GRITopicDoc });
        } else {
          missingCodes.push(batch[j]);
        }
      }
      // Fall back to querying by code field for any not found by ID
      if (missingCodes.length > 0) {
        const qSnap = await adminDb
          .collection("gri_topics")
          .where("code", "in", missingCodes)
          .get();
        for (const d of qSnap.docs) {
          const data = d.data() as GRITopicDoc;
          topicsMap.set(data.code, { id: d.id, ...data });
        }
      }
    }

    // Return topics in the assigned order
    const topics = assignedTopics
      .filter(code => topicsMap.has(code))
      .map(code => {
        const t = topicsMap.get(code)!;
        return {
          code:         t.code,
          name:         t.name,
          pillar:       t.pillar,
          pillarCode:   t.pillarCode,
          description:  t.description,
          griReference: t.griReference,
          questions:    t.questions ?? [],
        };
      });

    return Response.json({
      stakeholder: {
        id:           stakeholderId,
        name:         s.name,
        email:        s.email,
        type:         s.type,
        weight:       s.weight,
        organisation: s.organisation ?? "",
        topicCount:   assignedTopics.length,
      },
      assessment: {
        id: assessmentId,
        financialYear: (assessmentSnap.data() as { financialYear: string }).financialYear,
      },
      topics,
    });
  } catch (error) {
    console.error("[agent/survey GET]", error);
    return Response.json({ error: "server_error", message: "Failed to load survey data." }, { status: 500 });
  }
}
