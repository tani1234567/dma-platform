import OpenAI from "openai";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicInput {
  code: string;
  name: string;
  description: string;
  griReference: string;
  pillar: string;
  pillarCode: string;
  impactScore: number;
  financialScore: number;
  combinedScore: number;
  quadrant: string;
  respondentCount: number;
  comments: string[];
}

interface AnalysisRequestBody {
  companyName: string;
  financialYear: string;
  totalResponses: number;
  stakeholderCount: number;
  impactThreshold: number;
  financialThreshold: number;
  topics: TopicInput[];
}

function errRes(error: string, status: number) {
  return Response.json({ error }, { status });
}

// ─── POST /api/analysis/materiality ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.YEPAPI_API_KEY;
  if (!apiKey) return errRes("YEPAPI_API_KEY not configured", 500);

  let body: AnalysisRequestBody;
  try {
    body = (await req.json()) as AnalysisRequestBody;
  } catch {
    return errRes("Invalid request body", 400);
  }

  const { companyName, financialYear, totalResponses, stakeholderCount, impactThreshold, financialThreshold, topics } = body;

  if (!topics?.length) return errRes("No scored topics provided", 400);

  // Group by quadrant
  const byQuadrant: Record<string, TopicInput[]> = { critical: [], important: [], consider: [], monitor: [] };
  for (const t of topics) byQuadrant[t.quadrant]?.push(t);

  // Pillar averages
  const pillarMap: Record<string, { impact: number[]; financial: number[]; combined: number[] }> = {};
  for (const t of topics) {
    const p = t.pillarCode;
    if (!pillarMap[p]) pillarMap[p] = { impact: [], financial: [], combined: [] };
    pillarMap[p].impact.push(t.impactScore);
    pillarMap[p].financial.push(t.financialScore);
    pillarMap[p].combined.push(t.combinedScore);
  }
  const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : "N/A";

  const pillarSummary = Object.entries(pillarMap).map(([code, data]) => ({
    code,
    avgImpact: avg(data.impact),
    avgFinancial: avg(data.financial),
    avgCombined: avg(data.combined),
    topicCount: data.combined.length,
  }));

  // Collect all comments (anonymised)
  const allComments = topics
    .flatMap(t => t.comments.map(c => `[${t.code} – ${t.name}]: "${c}"`))
    .slice(0, 40); // cap to keep prompt lean

  const topicLines = topics
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .map(t => {
      const descPart = t.description ? ` | Desc: ${t.description}` : "";
      const griPart  = t.griReference ? ` | GRI: ${t.griReference}` : "";
      return `${t.code} — ${t.name}${griPart} | Pillar: ${t.pillarCode} | Impact: ${t.impactScore.toFixed(2)} | Financial: ${t.financialScore.toFixed(2)} | Combined: ${t.combinedScore.toFixed(2)} | Quadrant: ${t.quadrant} | Respondents: ${t.respondentCount}${descPart}`;
    })
    .join("\n");

  const prompt = `You are an expert ESG materiality analyst. Analyse the following materiality assessment data for ${companyName} (Financial Year: ${financialYear}) and produce a structured, insightful interpretation that a non-technical business leader can act on.

## Assessment Context
- Total stakeholders: ${stakeholderCount}
- Total responses received: ${totalResponses}
- Response rate: ${stakeholderCount > 0 ? Math.round((totalResponses / stakeholderCount) * 100) : 0}%
- Impact threshold: ${impactThreshold} / 5
- Financial threshold: ${financialThreshold} / 5

## Quadrant Summary
- Critical (High Impact + High Financial): ${byQuadrant.critical.length} topics — ${byQuadrant.critical.map(t => t.code).join(", ") || "none"}
- Important (High Impact + Low Financial): ${byQuadrant.important.length} topics — ${byQuadrant.important.map(t => t.code).join(", ") || "none"}
- Consider (Low Impact + High Financial): ${byQuadrant.consider.length} topics — ${byQuadrant.consider.map(t => t.code).join(", ") || "none"}
- Monitor (Low Impact + Low Financial): ${byQuadrant.monitor.length} topics — ${byQuadrant.monitor.map(t => t.code).join(", ") || "none"}

## Pillar Averages
${pillarSummary.map(p => `${p.code}: Avg Impact ${p.avgImpact} | Avg Financial ${p.avgCombined} | ${p.topicCount} topics`).join("\n")}

## All Scored Topics (ranked by combined score)
${topicLines}

${allComments.length > 0 ? `## Stakeholder Comments (anonymised sample)\n${allComments.join("\n")}` : ""}

## Instructions
You have the full list of scored topics with their names, GRI references, and scores above. Use the actual topic names (not just codes) when writing your analysis — reference specific topics by name to make the insights actionable. Produce a JSON object with exactly these keys. Each value must be a plain string (no markdown inside the strings):

{
  "headline": "One bold sentence summarising the overall materiality picture for this company (max 30 words)",
  "overallReadiness": "One of: Strong | Moderate | Developing | Needs Attention — based on average scores and quadrant distribution",
  "criticalTopicsInterpretation": "2-4 sentences explaining what the critical topics mean for this company, why they are high priority, and what the business risk/opportunity is",
  "importantTopicsInterpretation": "2-3 sentences on the Important quadrant — these have high impact but lower financial materiality. What should the company do?",
  "considerTopicsInterpretation": "2-3 sentences on the Consider quadrant — financially material but lower perceived impact. What does this signal?",
  "monitorTopicsInterpretation": "1-2 sentences on Monitor topics — what to watch for and why they still matter",
  "esgBalance": "2-3 sentences comparing Environmental, Social, and Governance pillar scores. Which pillar is strongest, which needs attention?",
  "stakeholderSignals": "2-3 sentences on what stakeholder comments and response patterns reveal about concerns or priorities",
  "topRecommendations": ["Recommendation 1 (specific, actionable)", "Recommendation 2", "Recommendation 3", "Recommendation 4", "Recommendation 5"],
  "risksIfUnaddressed": "2-3 sentences on the business, regulatory, or reputational risks if the critical and important topics are not addressed",
  "quickWins": "1-2 sentences identifying any topics that are relatively easy to address (e.g. moderate scores with clear action paths)"
}

Return ONLY valid JSON. No preamble, no explanation outside the JSON.`;

  const client = new OpenAI({
    apiKey: "placeholder",
    baseURL: "https://api.yepapi.com/v1/ai",
    defaultHeaders: { "x-api-key": apiKey },
  });

  try {
    const completion = await client.chat.completions.create({
      model: "claude-sonnet",
      max_tokens: 1500,
      messages: [
        { role: "system", content: "You are an expert ESG materiality analyst. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    // Strip markdown code fences if model wraps the JSON
    const jsonStr = raw.startsWith("```") ? raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "") : raw;

    let analysis: unknown;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      return errRes("Model returned malformed JSON", 500);
    }

    return Response.json({ analysis });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return errRes(`YepAPI error: ${msg}`, 500);
  }
}
