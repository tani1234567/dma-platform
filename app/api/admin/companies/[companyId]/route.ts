import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
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

// ─── Local types ──────────────────────────────────────────────────────────────

interface CompanyDoc {
  name: string;
  cinNumber?: string;
  industry?: string;
  address?: string;
  country?: string;
  manufacturingUnitLocation?: string;
  areaOfManufacturingUnit?: number;
  areaUnit?: string;
  logoURL?: string;
  status?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  totalWaterUsage_FY?: number;
  totalElectricityConsumption_FY?: number;
  totalFuelConsumption_FY?: number;
  fuelUnit?: string;
}

interface AssessmentDoc {
  financialYear: string;
  status: string;
  responseCount?: number;
  stakeholderCount?: number;
  launchedAt?: Timestamp;
  createdAt?: Timestamp;
}

interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  companyId?: string;
  isActive?: boolean;
  createdAt?: Timestamp;
}

// ─── GET /api/admin/companies/[companyId] ─────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<Response> {
  const sessionUid = request.cookies.get("__session")?.value;
  const claimsRaw  = request.cookies.get("__claims")?.value;
  if (!sessionUid || !claimsRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(claimsRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  const { companyId } = await params;

  try {
    const [companySnap, assessmentsSnap, adminUserSnap, agentsSnap] = await Promise.all([
      adminDb.collection("companies").doc(companyId).get(),
      adminDb.collection("companies").doc(companyId).collection("assessments")
        .orderBy("createdAt", "desc").get(),
      adminDb.collection("users").doc(companyId).get(),
      adminDb.collection("users")
        .where("role", "==", "field_agent")
        .where("companyId", "==", companyId)
        .get(),
    ]);

    if (!companySnap.exists) return errRes("not_found", "Company not found.", 404);

    const company = { id: companySnap.id, ...companySnap.data() } as CompanyDoc & { id: string };

    const assessments = assessmentsSnap.docs.map(d => {
      const a = d.data() as AssessmentDoc;
      const total = a.stakeholderCount ?? 0;
      const responded = a.responseCount ?? 0;
      return {
        id:           d.id,
        financialYear: a.financialYear,
        status:       a.status,
        responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
        responseCount: responded,
        stakeholderCount: total,
        launchedAt:   a.launchedAt?.toDate().toISOString() ?? null,
        createdAt:    a.createdAt?.toDate().toISOString() ?? "",
      };
    });

    const adminUser = adminUserSnap.exists
      ? (() => {
          const u = adminUserSnap.data() as UserDoc;
          return {
            uid:         adminUserSnap.id,
            email:       u.email,
            displayName: u.displayName,
            role:        u.role,
            companyId:   u.companyId,
            isActive:    u.isActive,
            createdAt:   u.createdAt?.toDate().toISOString() ?? "",
          };
        })()
      : null;

    const agentUsers = agentsSnap.docs.map(d => {
      const u = d.data() as UserDoc;
      return {
        uid:         d.id,
        email:       u.email,
        displayName: u.displayName,
        role:        u.role,
        companyId:   u.companyId,
        isActive:    u.isActive,
        createdAt:   u.createdAt?.toDate().toISOString() ?? "",
      };
    });

    return Response.json({ company, assessments, adminUser, agentUsers });
  } catch (error) {
    console.error("[admin/companies/[companyId] GET]", error);
    return Response.json({ error: "server_error", message: "Failed to fetch company." }, { status: 500 });
  }
}

// ─── PATCH /api/admin/companies/[companyId] — suspend / reactivate ────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<Response> {
  const sessionUid = request.cookies.get("__session")?.value;
  const claimsRaw  = request.cookies.get("__claims")?.value;
  if (!sessionUid || !claimsRaw) return errRes("unauthorized", "Authentication required.", 401);
  const claims = parseClaims(claimsRaw);
  if (!claims || claims.role !== "super_admin") return errRes("forbidden", "Super admin required.", 403);

  const { companyId } = await params;

  let body: { status: "active" | "suspended" };
  try { body = (await request.json()) as { status: "active" | "suspended" }; }
  catch { return errRes("bad_request", "Invalid request body.", 400); }

  if (body.status !== "active" && body.status !== "suspended")
    return errRes("bad_request", "status must be 'active' or 'suspended'.", 400);

  try {
    await adminDb.collection("companies").doc(companyId).update({
      status:    body.status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ success: true, status: body.status });
  } catch (error) {
    console.error("[admin/companies/[companyId] PATCH]", error);
    return Response.json({ error: "server_error", message: "Failed to update company." }, { status: 500 });
  }
}
