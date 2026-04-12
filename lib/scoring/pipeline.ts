/**
 * Shared scoring pipeline — reads responses from Firestore (Admin SDK),
 * runs calculateScores, and writes the result to the scores doc.
 * Used by both the /api/scores/recalculate route and the submit fire-and-forget.
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { calculateScores, type ScoreResult } from "./calculateScores";

// ─── Local types (admin SDK — avoids client Timestamp import) ─────────────────

interface RatingEntry {
  impact: number;
  financial: number;
  comment?: string;
}

interface ResponseDoc {
  weight: number;
  ratings: Record<string, RatingEntry>;
}

// ─── Scores document path ─────────────────────────────────────────────────────

function scoresRef(companyId: string, fyId: string) {
  return adminDb
    .collection("companies")
    .doc(companyId)
    .collection("assessments")
    .doc(fyId)
    .collection("scores")
    .doc("main");
}

function responsesRef(companyId: string, fyId: string) {
  return adminDb
    .collection("companies")
    .doc(companyId)
    .collection("assessments")
    .doc(fyId)
    .collection("responses");
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineResult {
  topicsScored: number;
  totalResponses: number;
}

export async function runScoringPipeline(
  companyId: string,
  fyId: string
): Promise<PipelineResult> {
  // 1. Fetch all response documents
  const snap = await responsesRef(companyId, fyId).get();

  const responses = snap.docs.map((d) => d.data() as ResponseDoc);

  // 2. Calculate scores
  const result: ScoreResult = calculateScores(responses);

  // 3. Write / overwrite the single scores document
  // Explicit field listing: replace the JS Date with a Firestore server timestamp
  await scoresRef(companyId, fyId).set({
    topicScores: result.topicScores,
    totalResponses: result.totalResponses,
    impactThreshold: result.impactThreshold,
    financialThreshold: result.financialThreshold,
    lastUpdated: FieldValue.serverTimestamp(),
  });

  return {
    topicsScored: Object.keys(result.topicScores).length,
    totalResponses: result.totalResponses,
  };
}
