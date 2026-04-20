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

interface CompanyDoc {
  name: string;
  cinNumber?: string;
  industry?: string;
  status?: string;
  createdAt?: Timestamp;
}

export interface CompanyListItem {
  id: string;
  name: string;
  cinNumber: string;
  industry: string;
  status: "active" | "suspended";
  createdAt: string;
  assessmentCount: number;
}

export async function GET(request: NextRequest): Promise<Response> {
  const sessionRaw = request.cookies.get("__session")?.value;
  if (!sessionRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(sessionRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  try {
    const snap = await adminDb.collection("companies").orderBy("createdAt", "desc").get();

    // Fetch assessment counts in parallel (batched)
    const companies = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data() as CompanyDoc;
        const countSnap = await adminDb
          .collection("companies").doc(d.id)
          .collection("assessments").count().get();

        return {
          id:              d.id,
          name:            data.name ?? "—",
          cinNumber:       data.cinNumber ?? "—",
          industry:        data.industry ?? "—",
          status:          (data.status ?? "active") as "active" | "suspended",
          createdAt:       data.createdAt?.toDate().toISOString() ?? "",
          assessmentCount: countSnap.data().count,
        } satisfies CompanyListItem;
      })
    );

    return Response.json({ companies, total: companies.length });
  } catch (error) {
    console.error("[admin/companies GET]", error);
    return Response.json({ error: "server_error", message: "Failed to fetch companies." }, { status: 500 });
  }
}
