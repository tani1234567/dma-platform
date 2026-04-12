/**
 * Pure scoring calculation — no Firebase dependency.
 * Input shape matches what the survey submit route writes to Firestore.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuadrantType = "critical" | "important" | "consider" | "monitor";

export interface TopicScore {
  impactScore: number;
  financialScore: number;
  combinedScore: number;
  quadrant: QuadrantType;
  respondentCount: number;
  comments: string[];
}

export interface ScoreResult {
  topicScores: Record<string, TopicScore>;
  totalResponses: number;
  lastUpdated: Date;
  impactThreshold: number;
  financialThreshold: number;
}

// Minimal input shape — only what the scoring algorithm needs
interface RatingEntry {
  impact: number;
  financial: number;
  comment?: string;
}

interface ResponseInput {
  weight: number;
  ratings: Record<string, RatingEntry>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IMPACT_THRESHOLD = 3.0;
const FINANCIAL_THRESHOLD = 3.0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getQuadrant(impact: number, financial: number): QuadrantType {
  const highImpact = impact >= IMPACT_THRESHOLD;
  const highFinancial = financial >= FINANCIAL_THRESHOLD;
  if (highImpact && highFinancial) return "critical";
  if (highImpact && !highFinancial) return "important";
  if (!highImpact && highFinancial) return "consider";
  return "monitor";
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Calculates weighted materiality scores from survey responses.
 * Each topic's score is weighted by the individual stakeholder weight —
 * the denominator is the sum of weights of stakeholders who rated THAT topic.
 */
export function calculateScores(responses: ResponseInput[]): ScoreResult {
  // topicCode → per-topic accumulators
  const acc = new Map<
    string,
    {
      impactSum: number;
      financialSum: number;
      weightSum: number;
      respondentCount: number;
      comments: string[];
    }
  >();

  for (const response of responses) {
    for (const [topicCode, rating] of Object.entries(response.ratings)) {
      const existing = acc.get(topicCode) ?? {
        impactSum: 0,
        financialSum: 0,
        weightSum: 0,
        respondentCount: 0,
        comments: [],
      };

      existing.impactSum += rating.impact * response.weight;
      existing.financialSum += rating.financial * response.weight;
      existing.weightSum += response.weight;
      existing.respondentCount++;
      if (rating.comment) existing.comments.push(rating.comment);

      acc.set(topicCode, existing);
    }
  }

  const topicScores: Record<string, TopicScore> = {};

  for (const [topicCode, data] of acc.entries()) {
    const impactScore = round2(data.impactSum / data.weightSum);
    const financialScore = round2(data.financialSum / data.weightSum);
    const combinedScore = round2((impactScore + financialScore) / 2);

    topicScores[topicCode] = {
      impactScore,
      financialScore,
      combinedScore,
      quadrant: getQuadrant(impactScore, financialScore),
      respondentCount: data.respondentCount,
      comments: data.comments,
    };
  }

  return {
    topicScores,
    totalResponses: responses.length,
    lastUpdated: new Date(),
    impactThreshold: IMPACT_THRESHOLD,
    financialThreshold: FINANCIAL_THRESHOLD,
  };
}
