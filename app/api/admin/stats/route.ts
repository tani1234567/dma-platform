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

export async function GET(request: NextRequest): Promise<Response> {
  const sessionUid = request.cookies.get("__session")?.value;
  const claimsRaw  = request.cookies.get("__claims")?.value;
  if (!sessionUid || !claimsRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(claimsRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  try {
    // Fetch all companies — top-level collection, no index needed
    const companiesSnap = await adminDb.collection("companies").get();
    const totalCompanies = companiesSnap.size;

    // Walk each company's subcollections — avoids collection group index requirement
    let activeAssessments = 0;
    let totalResponses    = 0;
    let totalStakeholders = 0;

    await Promise.all(
      companiesSnap.docs.map(async (companyDoc) => {
        const assessmentsSnap = await adminDb
          .collection("companies").doc(companyDoc.id)
          .collection("assessments")
          .get();

        await Promise.all(
          assessmentsSnap.docs.map(async (assessmentDoc) => {
            const data = assessmentDoc.data() as {
              status?: string;
              stakeholderCount?: number;
            };

            if (data.status === "stakeholder_survey") {
              activeAssessments++;
              totalStakeholders += data.stakeholderCount ?? 0;
            }

            const responsesCount = await adminDb
              .collection("companies").doc(companyDoc.id)
              .collection("assessments").doc(assessmentDoc.id)
              .collection("responses")
              .count()
              .get();

            totalResponses += responsesCount.data().count;
          })
        );
      })
    );

    return Response.json({
      totalCompanies,
      activeAssessments,
      totalResponses,
      totalStakeholders,
    });
  } catch (error) {
    console.error("[admin/stats GET]", error);
    return Response.json({ error: "server_error", message: "Failed to fetch stats." }, { status: 500 });
  }
}
