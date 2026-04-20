import { type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

interface RespondentDetail {
  stakeholderId: string;
  stakeholderName: string;
  stakeholderType: string;
  impact: number;
  financial: number;
  isProxySubmission: boolean;
  proxyAgentName?: string;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const fyId = searchParams.get("fyId");
    const topicCode = searchParams.get("topicCode");

    if (!companyId || !fyId || !topicCode) {
      return Response.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const assessmentSnap = await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("assessments")
      .where("financialYear", "==", fyId)
      .limit(1)
      .get();

    if (assessmentSnap.empty) {
      return Response.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    const assessmentId = assessmentSnap.docs[0].id;

    const responsesSnap = await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("assessments")
      .doc(assessmentId)
      .collection("responses")
      .get();

    const respondents: RespondentDetail[] = [];

    // Collect unique agent UIDs to batch-fetch agent names
    const agentUids = new Set<string>();
    const responseRows: Array<{
      stakeholderId: string;
      stakeholderType: string;
      rating: { impact: number; financial: number };
      isProxySubmission: boolean;
      proxyAgentUid?: string;
    }> = [];

    for (const doc of responsesSnap.docs) {
      const data = doc.data() as {
        stakeholderId: string;
        stakeholderType: string;
        ratings?: Record<string, { impact: number; financial: number }>;
        isProxySubmission?: boolean;
        proxyAgentUid?: string;
      };

      if (!data.ratings?.[topicCode]) continue;
      if (data.isProxySubmission && data.proxyAgentUid) agentUids.add(data.proxyAgentUid);
      responseRows.push({
        stakeholderId:     data.stakeholderId,
        stakeholderType:   data.stakeholderType,
        rating:            data.ratings[topicCode],
        isProxySubmission: data.isProxySubmission ?? false,
        proxyAgentUid:     data.proxyAgentUid,
      });
    }

    // Batch-fetch stakeholder names
    const stakeholderIds = [...new Set(responseRows.map(r => r.stakeholderId))];
    const stakeholderNames = new Map<string, string>();
    await Promise.all(
      stakeholderIds.map(async (sid) => {
        const snap = await adminDb
          .collection("companies").doc(companyId)
          .collection("assessments").doc(assessmentId)
          .collection("stakeholders").doc(sid)
          .get();
        stakeholderNames.set(sid, (snap.data() as { name?: string })?.name ?? "Unknown");
      })
    );

    // Batch-fetch agent names
    const agentNames = new Map<string, string>();
    await Promise.all(
      Array.from(agentUids).map(async (uid) => {
        const snap = await adminDb.collection("users").doc(uid).get();
        agentNames.set(uid, (snap.data() as { displayName?: string })?.displayName ?? "Agent");
      })
    );

    for (const row of responseRows) {
      respondents.push({
        stakeholderId:     row.stakeholderId,
        stakeholderName:   stakeholderNames.get(row.stakeholderId) ?? "Unknown",
        stakeholderType:   row.stakeholderType,
        impact:            row.rating.impact,
        financial:         row.rating.financial,
        isProxySubmission: row.isProxySubmission,
        proxyAgentName:    row.proxyAgentUid ? agentNames.get(row.proxyAgentUid) : undefined,
      });
    }

    return Response.json({ respondents });
  } catch (error) {
    console.error("[results/respondents GET]", error);
    return Response.json(
      { error: "server_error", message: "Failed to fetch respondents" },
      { status: 500 }
    );
  }
}
