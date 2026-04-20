import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { runScoringPipeline } from "@/lib/scoring/pipeline";

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

function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

// Per-question rating sent from the agent form
interface QuestionRating {
  impact: number;   // 1–5
  financial: number; // 1–5
}

interface SubmitBody {
  stakeholderId: string;
  assessmentId: string;
  // Keys are question IDs, e.g. "E1_Q1", "E1_Q2"
  ratings: Record<string, QuestionRating>;
  // Optional per-topic comments, keyed by topic code
  comments?: Record<string, string>;
}

interface GRIQuestionDoc { id: string; text: string; }
interface GRITopicDoc {
  code: string;
  questions: GRIQuestionDoc[];
}

export async function POST(request: NextRequest): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "field_agent") return errRes("forbidden", "Field agent access required.", 403);

  const companyId = await getAgentCompanyId(claims.uid);
  if (!companyId) return errRes("not_found", "No company assigned to this agent.", 404);

  let body: SubmitBody;
  try { body = await request.json() as SubmitBody; }
  catch { return errRes("bad_request", "Invalid request body.", 400); }

  const { stakeholderId, assessmentId, ratings, comments = {} } = body;
  if (!stakeholderId || !assessmentId || !ratings || typeof ratings !== "object")
    return errRes("bad_request", "stakeholderId, assessmentId, and ratings are required.", 400);

  try {
    const assessmentRef = adminDb
      .collection("companies").doc(companyId)
      .collection("assessments").doc(assessmentId);

    const [assessmentSnap, stakeholderSnap] = await Promise.all([
      assessmentRef.get(),
      assessmentRef.collection("stakeholders").doc(stakeholderId).get(),
    ]);

    if (!assessmentSnap.exists) return errRes("not_found", "Assessment not found.", 404);
    if (!stakeholderSnap.exists) return errRes("not_found", "Stakeholder not found.", 404);

    const s = stakeholderSnap.data() as {
      type: string;
      weight: number;
      status: string;
      assignedTopics?: string[];
    };

    if (s.status === "completed")
      return errRes("conflict", "Survey already submitted for this stakeholder.", 409);

    const assignedTopics: string[] = s.assignedTopics ?? [];
    if (assignedTopics.length === 0)
      return errRes("bad_request", "No topics assigned to this stakeholder.", 400);

    // ── Fetch GRI topic data to resolve question IDs → topic codes ────────────

    const topicMap = new Map<string, GRITopicDoc>(); // topicCode → topic

    for (let i = 0; i < assignedTopics.length; i += 10) {
      const batch = assignedTopics.slice(i, i + 10);
      const directDocs = await Promise.all(
        batch.map(code => adminDb.collection("gri_topics").doc(code).get())
      );
      const missing: string[] = [];
      for (let j = 0; j < directDocs.length; j++) {
        if (directDocs[j].exists) {
          topicMap.set(batch[j], directDocs[j].data() as GRITopicDoc);
        } else {
          missing.push(batch[j]);
        }
      }
      if (missing.length > 0) {
        const qSnap = await adminDb
          .collection("gri_topics").where("code", "in", missing).get();
        for (const d of qSnap.docs) {
          const data = d.data() as GRITopicDoc;
          topicMap.set(data.code, data);
        }
      }
    }

    // Build a map: questionId → topicCode for validation
    const questionToTopic = new Map<string, string>();
    for (const [topicCode, topic] of topicMap) {
      for (const q of topic.questions ?? []) {
        questionToTopic.set(q.id, topicCode);
      }
    }

    // ── Validate ratings ──────────────────────────────────────────────────────

    for (const [qId, r] of Object.entries(ratings)) {
      if (!questionToTopic.has(qId))
        return errRes("bad_request", `Question "${qId}" is not part of any assigned topic.`, 400);
      if (!isValidScore(r.impact))
        return errRes("bad_request", `impact for "${qId}" must be an integer 1–5.`, 400);
      if (!isValidScore(r.financial))
        return errRes("bad_request", `financial for "${qId}" must be an integer 1–5.`, 400);
    }

    // Check every question in every assigned topic is rated
    const missingQuestions: string[] = [];
    for (const [topicCode, topic] of topicMap) {
      for (const q of topic.questions ?? []) {
        if (!ratings[q.id]) missingQuestions.push(`${topicCode}: ${q.id}`);
      }
    }
    if (missingQuestions.length > 0)
      return errRes("bad_request", `Missing ratings for questions: ${missingQuestions.slice(0, 5).join(", ")}`, 400);

    // ── Aggregate per-question ratings → per-topic ratings ────────────────────
    // Average impact and average financial across all questions in each topic.
    // This produces the same shape as the public survey submit and feeds into
    // the existing calculateScores pipeline without modification.

    const topicRatings: Record<string, { impact: number; financial: number; comment?: string }> = {};

    for (const [topicCode, topic] of topicMap) {
      const qs = topic.questions ?? [];
      if (qs.length === 0) continue;

      let impactSum = 0;
      let financialSum = 0;

      for (const q of qs) {
        const r = ratings[q.id];
        if (r) {
          impactSum    += r.impact;
          financialSum += r.financial;
        }
      }

      const count = qs.length;
      const aggregated: { impact: number; financial: number; comment?: string } = {
        // Round to nearest integer so scores stay in the 1–5 integer range expected
        impact:    Math.round(impactSum / count),
        financial: Math.round(financialSum / count),
      };

      const comment = comments[topicCode]?.trim();
      if (comment) aggregated.comment = comment;

      topicRatings[topicCode] = aggregated;
    }

    // ── Atomic batch write ────────────────────────────────────────────────────

    const batchWrite = adminDb.batch();

    const responseRef = assessmentRef.collection("responses").doc();
    batchWrite.set(responseRef, {
      stakeholderId,
      stakeholderType:   s.type,
      companyId,
      assessmentId,
      weight:            s.weight,
      ratings:           topicRatings,   // topic-level, same format as public survey
      submittedAt:       FieldValue.serverTimestamp(),
      isProxySubmission: true,
      proxyAgentUid:     claims.uid,
    });

    batchWrite.update(assessmentRef.collection("stakeholders").doc(stakeholderId), {
      status:            "completed",
      isProxySubmission: true,
      proxyAgentUid:     claims.uid,
      submittedAt:       FieldValue.serverTimestamp(),
      updatedAt:         FieldValue.serverTimestamp(),
    });

    batchWrite.update(assessmentRef, {
      responseCount: FieldValue.increment(1),
      updatedAt:     FieldValue.serverTimestamp(),
    });

    await batchWrite.commit();

    // Fire-and-forget score recalculation — identical to public survey submit
    runScoringPipeline(companyId, assessmentId).catch((err: unknown) => {
      console.error("[agent/submit] Background scoring failed:", err);
    });

    return Response.json({ success: true, responseId: responseRef.id });
  } catch (error) {
    console.error("[agent/submit POST]", error);
    return Response.json({ error: "server_error", message: "Failed to submit survey." }, { status: 500 });
  }
}
