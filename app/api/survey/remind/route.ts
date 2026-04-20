import { type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { sendSurveyReminder } from "@/lib/brevo/emails";

export const dynamic = "force-dynamic";

// ─── Local types ──────────────────────────────────────────────────────────────

interface StakeholderData {
  name: string;
  email: string;
  type: string;
  surveyToken: string;
  surveyLink?: string;
  status: string;
  reminderCount?: number;
  tokenExpiresAt: FirebaseFirestore.Timestamp;
}

interface CompanyData {
  name: string;
}

interface RemindBody {
  companyId: string;
  fyId: string;
  stakeholderIds?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errRes(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function parseClaims(raw: string): { role: string; uid: string } | null {
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString()) as {
      role: string;
      uid: string;
    };
  } catch {
    return null;
  }
}

function daysUntil(ts: FirebaseFirestore.Timestamp): number {
  return Math.max(
    0,
    Math.ceil((ts.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
}

function formatDate(ts: FirebaseFirestore.Timestamp): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(ts.toDate());
}

function clampReminderNumber(n: number): 1 | 2 | 3 {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  return 3;
}

// ─── POST /api/survey/remind ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const sessionRaw = request.cookies.get("__session")?.value;

    if (!sessionRaw) {
      return errRes("unauthorized", "Authentication required.", 401);
    }

    const claims = parseClaims(sessionRaw);
    if (!claims || claims.role !== "company_admin") {
      return errRes("forbidden", "Company admin access required.", 403);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: RemindBody;
    try {
      body = (await request.json()) as RemindBody;
    } catch {
      return errRes("bad_request", "Invalid request body.", 400);
    }

    const { companyId, fyId, stakeholderIds } = body;

    if (!companyId || !fyId) {
      return errRes("bad_request", "companyId and fyId are required.", 400);
    }

    if (claims.uid !== companyId) {
      return errRes("forbidden", "Access denied for this company.", 403);
    }

    // ── Fetch company name ────────────────────────────────────────────────────
    const companySnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companySnap.exists) {
      return errRes("not_found", "Company not found.", 404);
    }
    const company = companySnap.data() as CompanyData;

    // ── Fetch all stakeholders, filter in memory ───────────────────────────────
    const stakeholderSnap = await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("assessments")
      .doc(fyId)
      .collection("stakeholders")
      .get();

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("host") ?? "localhost:3000"}`;

    // Determine eligible stakeholders
    const eligible = stakeholderSnap.docs.filter((doc) => {
      const s = doc.data() as StakeholderData;
      if (stakeholderIds) {
        return stakeholderIds.includes(doc.id);
      }
      // Default: sent or opened, reminder count < 3, not expired/completed
      const count = s.reminderCount ?? 0;
      return (
        (s.status === "sent" || s.status === "opened") &&
        count < 3
      );
    });

    if (eligible.length === 0) {
      return Response.json({ success: true, remindersSent: 0, message: "No eligible stakeholders." });
    }

    // ── Send reminders + batch update ─────────────────────────────────────────
    let remindersSent = 0;
    let remindersFailed = 0;
    const batch = adminDb.batch();

    for (const doc of eligible) {
      const s = doc.data() as StakeholderData;
      const currentCount = s.reminderCount ?? 0;
      const reminderNumber = clampReminderNumber(currentCount + 1);
      const surveyLink =
        s.surveyLink ?? `${appUrl}/survey?token=${s.surveyToken}`;
      const expiryDate = formatDate(s.tokenExpiresAt);
      const daysRemaining = daysUntil(s.tokenExpiresAt);

      const result = await sendSurveyReminder({
        toEmail: s.email,
        toName: s.name,
        companyName: company.name,
        surveyLink,
        expiryDate,
        reminderNumber,
        daysRemaining,
      });

      if (result.success) {
        remindersSent++;
        console.log(
          `[remind] #${reminderNumber} sent to ${s.name} <${s.email}> | msgId: ${result.messageId ?? "n/a"}`
        );
      } else {
        remindersFailed++;
        console.warn(`[remind] Failed for ${s.name} <${s.email}>`);
      }

      // Update regardless of email success — count the attempt
      batch.update(doc.ref, {
        reminderCount: FieldValue.increment(1),
        lastReminderAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return Response.json({
      success: true,
      remindersSent,
      remindersFailed,
      total: eligible.length,
    });
  } catch (error) {
    console.error("[survey/remind POST]", error);
    return Response.json(
      { error: "server_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
