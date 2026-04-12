import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { runScoringPipeline } from "@/lib/scoring/pipeline";

export const dynamic = "force-dynamic";

// ─── Local interfaces ─────────────────────────────────────────────────────────

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

interface AssessmentData {
  financialYear: string;
  selectedTopics: string[];
}

interface RatingEntry {
  impact: number;
  financial: number;
  comment?: string;
}

interface SubmitBody {
  token: string;
  ratings: Record<string, RatingEntry>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

// ─── POST /api/survey/submit ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // ── Parse body ───────────────────────────────────────────────────────────
    let body: SubmitBody;
    try {
      body = (await request.json()) as SubmitBody;
    } catch {
      return errRes("bad_request", "Invalid request body.", 400);
    }

    const { token, ratings } = body;

    if (!token || typeof token !== "string") {
      return errRes("bad_request", "Missing or invalid token.", 400);
    }
    if (!ratings || typeof ratings !== "object" || Array.isArray(ratings)) {
      return errRes("bad_request", "Missing or invalid ratings.", 400);
    }

    // ── Locate stakeholder via collectionGroup ───────────────────────────────
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

    // Extract path components: companies/{companyId}/assessments/{fyId}/stakeholders/{id}
    const segments = stakeholderDoc.ref.path.split("/");
    const companyId = segments[1];
    const fyId = segments[3];
    const stakeholderId = stakeholderDoc.id;

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

    // ── Fetch assessment to validate topic codes ─────────────────────────────
    const assessmentSnap = await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("assessments")
      .doc(fyId)
      .get();

    if (!assessmentSnap.exists) {
      return errRes("invalid_token", "This survey link is not valid.", 404);
    }

    const assessment = assessmentSnap.data() as AssessmentData;
    // Validate against stakeholder's assigned topics; fall back to all selected topics
    const validTopics = new Set<string>(
      s.assignedTopics && s.assignedTopics.length > 0
        ? s.assignedTopics
        : (assessment.selectedTopics ?? [])
    );

    // ── Validate ratings ─────────────────────────────────────────────────────
    const ratingEntries = Object.entries(ratings);
    if (ratingEntries.length === 0) {
      return errRes("bad_request", "Ratings cannot be empty.", 400);
    }

    for (const [topicCode, entry] of ratingEntries) {
      if (!validTopics.has(topicCode)) {
        return errRes(
          "bad_request",
          `Topic "${topicCode}" is not assigned to this stakeholder.`,
          400
        );
      }
      if (!isValidScore(entry.impact)) {
        return errRes(
          "bad_request",
          `Impact score for "${topicCode}" must be an integer between 1 and 5.`,
          400
        );
      }
      if (!isValidScore(entry.financial)) {
        return errRes(
          "bad_request",
          `Financial score for "${topicCode}" must be an integer between 1 and 5.`,
          400
        );
      }
      if (entry.comment !== undefined && typeof entry.comment !== "string") {
        return errRes("bad_request", `Comment for "${topicCode}" must be a string.`, 400);
      }
    }

    // ── Atomic batch write ───────────────────────────────────────────────────
    const assessmentRef = adminDb
      .collection("companies")
      .doc(companyId)
      .collection("assessments")
      .doc(fyId);

    const responseRef = assessmentRef.collection("responses").doc();

    const batch = adminDb.batch();

    // 1. Write response document
    batch.set(responseRef, {
      stakeholderId,
      stakeholderType: s.type,
      weight: s.weight,
      ratings,
      submittedAt: FieldValue.serverTimestamp(),
      isProxySubmission: false,
      proxyAgentUid: null,
    });

    // 2. Mark stakeholder as submitted
    batch.update(stakeholderDoc.ref, {
      status: "completed",
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 3. Increment response count on assessment
    batch.update(assessmentRef, {
      responseCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Fire-and-forget score recalculation — does not block the response
    runScoringPipeline(companyId, fyId).catch((err: unknown) => {
      console.error("[survey/submit] Background scoring failed:", err);
    });

    return Response.json({ success: true, message: "Survey submitted successfully." });
  } catch (error) {
    console.error("[survey/submit POST]", error);
    return Response.json(
      { error: "server_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
