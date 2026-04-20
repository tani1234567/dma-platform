import { type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import type { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}
function parseClaims(raw: string): { role: string; uid: string } | null {
  try { return JSON.parse(Buffer.from(raw, "base64").toString()) as { role: string; uid: string }; }
  catch { return null; }
}

interface ActivityItem {
  type: "company_registered" | "assessment_launched";
  label: string;
  sub: string;
  ts: string;
}

export async function GET(request: NextRequest): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  try {
    // Fetch recent companies — no index needed
    const companiesSnap = await adminDb
      .collection("companies")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const items: ActivityItem[] = [];

    // Add company_registered events
    for (const d of companiesSnap.docs) {
      const data = d.data() as { name: string; industry?: string; createdAt?: Timestamp };
      items.push({
        type:  "company_registered",
        label: data.name,
        sub:   data.industry ?? "Unknown industry",
        ts:    data.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
      });
    }

    // Walk each company's assessments subcollection — no collection group index needed
    await Promise.all(
      companiesSnap.docs.map(async (companyDoc) => {
        const companyData = companyDoc.data() as { name: string };
        const assessmentsSnap = await adminDb
          .collection("companies").doc(companyDoc.id)
          .collection("assessments")
          .orderBy("createdAt", "desc")
          .limit(5)
          .get();

        for (const a of assessmentsSnap.docs) {
          const data = a.data() as { financialYear: string; status: string; createdAt?: Timestamp };
          if (data.status === "draft") continue; // skip un-launched
          items.push({
            type:  "assessment_launched",
            label: `${companyData.name} — FY ${data.financialYear}`,
            sub:   `Status: ${data.status.replace(/_/g, " ")}`,
            ts:    data.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
          });
        }
      })
    );

    // Sort combined list by ts desc and take top 10
    items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    return Response.json({ activity: items.slice(0, 10) });
  } catch (error) {
    console.error("[admin/activity GET]", error);
    return Response.json({ error: "server_error", message: "Failed to fetch activity." }, { status: 500 });
  }
}
