import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { sendSurveyInvite } from "@/lib/brevo/emails";

export const dynamic = "force-dynamic";

// ─── Local types ──────────────────────────────────────────────────────────────

interface StakeholderData {
  name: string;
  email: string;
  type: string;
  weight: number;
  surveyToken: string;
  tokenExpiresAt: FirebaseFirestore.Timestamp;
  status: string;
}

interface AssessmentData {
  status: string;
  financialYear: string;
  stakeholderCount?: number;
}

interface CompanyData {
  name: string;
}

interface LaunchBody {
  companyId: string;
  fyId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function formatDate(ts: FirebaseFirestore.Timestamp): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(ts.toDate());
}

function parseClaims(
  raw: string
): { role: string; uid: string } | null {
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString()) as {
      role: string;
      uid: string;
    };
  } catch {
    return null;
  }
}

// ─── POST /api/survey/launch ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const sessionRaw = request.cookies.get("__session")?.value;

    if (!sessionRaw) {
      return errRes("unauthorized", "Authentication required.", 401);
    }

    const claims = parseClaims(sessionRaw);
    if (!claims || claims.role !== "company_admin") {
      return errRes("forbidden", "Company admin access required.", 403);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: LaunchBody;
    try {
      body = (await request.json()) as LaunchBody;
    } catch {
      return errRes("bad_request", "Invalid request body.", 400);
    }

    const { companyId, fyId } = body;

    if (!companyId || !fyId) {
      return errRes("bad_request", "companyId and fyId are required.", 400);
    }

    // The company admin can only launch their own company's assessment
    if (claims.uid !== companyId) {
      return errRes("forbidden", "Access denied for this company.", 403);
    }

    // ── Fetch assessment ──────────────────────────────────────────────────────
    const assessmentRef = adminDb
      .collection("companies")
      .doc(companyId)
      .collection("assessments")
      .doc(fyId);

    const assessmentSnap = await assessmentRef.get();
    if (!assessmentSnap.exists) {
      return errRes("not_found", "Assessment not found.", 404);
    }

    const assessment = assessmentSnap.data() as AssessmentData;

    // Allow full launch (draft) or re-launch to pending stakeholders (active)
    const isRelaunching = assessment.status === "stakeholder_survey";
    if (assessment.status !== "draft" && !isRelaunching) {
      return errRes(
        "invalid_status",
        "Cannot send invites for an assessment in its current status.",
        409
      );
    }

    // ── Fetch company name ────────────────────────────────────────────────────
    const companySnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companySnap.exists) {
      return errRes("not_found", "Company not found.", 404);
    }
    const company = companySnap.data() as CompanyData;

    // ── Fetch stakeholders ────────────────────────────────────────────────────
    const stakeholderSnap = await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("assessments")
      .doc(fyId)
      .collection("stakeholders")
      .get();

    if (stakeholderSnap.empty) {
      return errRes("bad_request", "No stakeholders found for this assessment.", 400);
    }

    // On re-launch, only email stakeholders who haven't received an invite yet
    const docsToEmail = isRelaunching
      ? stakeholderSnap.docs.filter(d => (d.data() as StakeholderData).status === "pending")
      : stakeholderSnap.docs;

    if (docsToEmail.length === 0) {
      return Response.json({
        success: true,
        emailsSent: 0,
        emailsFailed: 0,
        total: 0,
        message: "No new stakeholders to invite.",
      });
    }

    // ── Build survey links + send Brevo invites ───────────────────────────────
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("host") ?? "localhost:3000"}`;

    let emailsSent = 0;
    let emailsFailed = 0;

    const batch = adminDb.batch();

    for (const doc of docsToEmail) {
      const s = doc.data() as StakeholderData;
      const surveyLink = `${appUrl}/survey?token=${s.surveyToken}`;
      const expiryDate = formatDate(s.tokenExpiresAt);

      // Send invite email
      const result = await sendSurveyInvite({
        toEmail: s.email,
        toName: s.name,
        companyName: company.name,
        surveyLink,
        expiryDate,
      });

      if (result.success) {
        emailsSent++;
        console.log(`[launch] Email sent to ${s.name} <${s.email}> | msgId: ${result.messageId ?? "n/a"}`);
      } else {
        emailsFailed++;
        console.warn(`[launch] Email failed for ${s.name} <${s.email}>`);
      }

      // Queue stakeholder update in batch
      batch.update(doc.ref, {
        surveyLink,
        status: "sent",
        emailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // First launch: mark assessment active and set count.
    // Re-launch: update count to actual total (not an increment — deletions
    // would make an increment permanently wrong).
    if (isRelaunching) {
      batch.update(assessmentRef, {
        stakeholderCount: stakeholderSnap.size,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      batch.update(assessmentRef, {
        status: "stakeholder_survey",
        launchedAt: FieldValue.serverTimestamp(),
        stakeholderCount: stakeholderSnap.size,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return Response.json({
      success: true,
      emailsSent,
      emailsFailed,
      total: docsToEmail.length,
    });
  } catch (error) {
    console.error("[survey/launch POST]", error);
    return Response.json(
      { error: "server_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
