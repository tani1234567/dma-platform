import { type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import type { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

interface ProxyRow {
  responseId:      string;
  stakeholderName: string;
  stakeholderType: string;
  organisation:    string;
  agentName:       string;
  topicsRated:     number;
  avgImpact:       number;
  avgFinancial:    number;
  avgCombined:     number;
  submittedAt:     string;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const fyId      = searchParams.get("fyId");

    if (!companyId || !fyId)
      return Response.json({ error: "Missing companyId or fyId" }, { status: 400 });

    // Resolve assessmentId from financialYear
    const asmSnap = await adminDb
      .collection("companies").doc(companyId)
      .collection("assessments")
      .where("financialYear", "==", fyId)
      .limit(1).get();

    if (asmSnap.empty)
      return Response.json({ proxySubmissions: [] });

    const assessmentId = asmSnap.docs[0].id;
    const baseRef = adminDb
      .collection("companies").doc(companyId)
      .collection("assessments").doc(assessmentId);

    // Fetch proxy responses only
    const responsesSnap = await baseRef
      .collection("responses")
      .where("isProxySubmission", "==", true)
      .get();

    if (responsesSnap.empty)
      return Response.json({ proxySubmissions: [] });

    // Collect unique stakeholder and agent IDs
    const stakeholderIds = new Set<string>();
    const agentIds       = new Set<string>();

    type RawResponse = {
      stakeholderId:     string;
      stakeholderType:   string;
      proxyAgentUid?:    string;
      ratings?:          Record<string, { impact: number; financial: number }>;
      submittedAt?:      Timestamp;
    };

    const rawRows: Array<{ id: string; data: RawResponse }> = [];

    for (const doc of responsesSnap.docs) {
      const data = doc.data() as RawResponse;
      stakeholderIds.add(data.stakeholderId);
      if (data.proxyAgentUid) agentIds.add(data.proxyAgentUid);
      rawRows.push({ id: doc.id, data });
    }

    // Batch-fetch stakeholder docs
    const stakeholderMap = new Map<string, { name: string; organisation: string }>();
    await Promise.all(
      Array.from(stakeholderIds).map(async (sid) => {
        const snap = await baseRef.collection("stakeholders").doc(sid).get();
        const d = snap.data() as { name?: string; organisation?: string } | undefined;
        stakeholderMap.set(sid, {
          name:         d?.name         ?? "Unknown",
          organisation: d?.organisation ?? "—",
        });
      })
    );

    // Batch-fetch agent names
    const agentMap = new Map<string, string>();
    await Promise.all(
      Array.from(agentIds).map(async (uid) => {
        const snap = await adminDb.collection("users").doc(uid).get();
        const d = snap.data() as { displayName?: string } | undefined;
        agentMap.set(uid, d?.displayName ?? "Agent");
      })
    );

    // Build result rows
    const proxySubmissions: ProxyRow[] = rawRows.map(({ id, data }) => {
      const ratings  = data.ratings ?? {};
      const entries  = Object.values(ratings);
      const count    = entries.length;
      const avgImpact    = count > 0 ? entries.reduce((s, r) => s + r.impact,    0) / count : 0;
      const avgFinancial = count > 0 ? entries.reduce((s, r) => s + r.financial, 0) / count : 0;
      const avgCombined  = (avgImpact + avgFinancial) / 2;

      const stk = stakeholderMap.get(data.stakeholderId) ?? { name: "Unknown", organisation: "—" };

      return {
        responseId:      id,
        stakeholderName: stk.name,
        stakeholderType: data.stakeholderType,
        organisation:    stk.organisation,
        agentName:       data.proxyAgentUid ? (agentMap.get(data.proxyAgentUid) ?? "Agent") : "—",
        topicsRated:     count,
        avgImpact:       Math.round(avgImpact    * 100) / 100,
        avgFinancial:    Math.round(avgFinancial * 100) / 100,
        avgCombined:     Math.round(avgCombined  * 100) / 100,
        submittedAt:     data.submittedAt?.toDate().toISOString() ?? "",
      };
    });

    // Sort newest first
    proxySubmissions.sort((a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    return Response.json({ proxySubmissions });
  } catch (error) {
    console.error("[results/proxy-submissions GET]", error);
    return Response.json({ error: "server_error", message: "Failed to fetch proxy submissions." }, { status: 500 });
  }
}
