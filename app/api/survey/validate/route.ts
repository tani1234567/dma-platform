import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

// ─── Local interfaces (admin SDK — avoids client Timestamp import) ────────────

interface StakeholderData {
  name: string;
  email: string;
  type: string;
  weight: number;
  surveyToken: string;
  status: string;
  tokenExpiresAt: FirebaseFirestore.Timestamp;
  assignedTopics?: string[];
}

interface CompanyData {
  name: string;
  logoURL?: string;
}

interface AssessmentData {
  financialYear: string;
  selectedTopics: string[];
}

interface GRITopicData {
  id: string;
  code: string;
  name: string;
  pillar: string;
  pillarCode: string;
  description: string;
  griReference: string;
  questions: Array<{ id: string; text: string }>;
  subTopics?: Array<{ id: string; code: string; name: string; description?: string }>;
  isActive: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── GET /api/survey/validate?token={uuid} ────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return errRes("invalid_token", "This survey link is not valid.", 404);
    }

    // collectionGroup query — requires Firestore index:
    //   Collection group: stakeholders | Field: surveyToken ASC
    const snap = await adminDb
      .collectionGroup("stakeholders")
      .where("surveyToken", "==", token)
      .limit(1)
      .get();

    if (snap.empty) {
      return errRes("invalid_token", "This survey link is not valid.", 404);
    }

    const stakeholderDoc = snap.docs[0];
    const s = stakeholderDoc.data() as StakeholderData;

    // Extract companyId and fyId from document path:
    // companies/{companyId}/assessments/{fyId}/stakeholders/{id}
    const segments = stakeholderDoc.ref.path.split("/");
    const companyId = segments[1];
    const fyId = segments[3];

    // Already submitted?
    if (s.status === "completed") {
      return errRes("already_submitted", "You have already submitted this survey.", 409);
    }

    // Expired?
    if (s.tokenExpiresAt && s.tokenExpiresAt.toDate() < new Date()) {
      await stakeholderDoc.ref.update({
        status: "expired",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return errRes("expired", "This survey link has expired.", 410);
    }

    // Fetch company and assessment in parallel
    const [companySnap, assessmentSnap] = await Promise.all([
      adminDb.collection("companies").doc(companyId).get(),
      adminDb
        .collection("companies")
        .doc(companyId)
        .collection("assessments")
        .doc(fyId)
        .get(),
    ]);

    if (!companySnap.exists || !assessmentSnap.exists) {
      return errRes("invalid_token", "This survey link is not valid.", 404);
    }

    const company = companySnap.data() as CompanyData;
    const assessment = assessmentSnap.data() as AssessmentData;
    // Use stakeholder's assigned topics if set; fall back to all selected topics
    const selectedTopics: string[] = assessment.selectedTopics ?? [];
    const topicsToFetch: string[] =
      s.assignedTopics && s.assignedTopics.length > 0
        ? s.assignedTopics
        : selectedTopics;

    // Fetch full GRI topic objects for the stakeholder's topic codes.
    // Firestore 'in' supports up to 30 values — chunk larger arrays.
    const topicDocs: GRITopicData[] = [];
    if (topicsToFetch.length > 0) {
      const chunks = chunk(topicsToFetch, 30);
      const results = await Promise.all(
        chunks.map((codes) =>
          adminDb
            .collection("gri_topics")
            .where("code", "in", codes)
            .where("isActive", "==", true)
            .get()
        )
      );
      for (const r of results) {
        for (const d of r.docs) {
          topicDocs.push({ id: d.id, ...d.data() } as GRITopicData);
        }
      }
    }

    return Response.json({
      stakeholderId: stakeholderDoc.id,
      stakeholderName: s.name,
      stakeholderType: s.type,
      companyId,
      fyId,
      company: {
        companyName: company.name,
        logoUrl: company.logoURL ?? null,
      },
      assessment: {
        fyYear: assessment.financialYear,
        selectedTopics: topicsToFetch,
      },
      topics: topicDocs,
    });
  } catch (error) {
    console.error("[survey/validate GET]", error);
    return Response.json(
      { error: "server_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
