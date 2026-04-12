import brevo from "./client";

// ─── Shared constants ─────────────────────────────────────────────────────────

const SENDER = {
  email: process.env.BREVO_SENDER_EMAIL ?? "noreply@swifora.com",
  name: process.env.BREVO_SENDER_NAME ?? "Swifora DMA Platform",
};

// ─── HTML email builder helpers ───────────────────────────────────────────────

function emailWrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:#333a8b;border-radius:12px 12px 0 0;padding:20px 28px">
      <span style="color:#fff;font-size:16px;font-weight:700">Swifora DMA Platform</span>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:32px 28px">
      ${body}
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:11px;margin:16px 0 0">
      © Swifora DMA Platform · Received because you were added as a survey stakeholder.
    </p>
  </div>
</body>
</html>`;
}

function h2(text: string): string {
  return `<h2 style="color:#111827;font-size:18px;font-weight:700;margin:0 0 20px">${text}</h2>`;
}

function p(text: string): string {
  return `<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px">${text}</p>`;
}

function small(text: string): string {
  return `<p style="color:#6b7280;font-size:13px;line-height:1.6;margin:16px 0 0">${text}</p>`;
}

function ctaButton(href: string, label: string, bg = "#ff6900"): string {
  return `<div style="text-align:center;margin:28px 0">
    <a href="${href}" style="background:${bg};color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
      ${label}
    </a>
  </div>
  <p style="text-align:center;color:#6b7280;font-size:12px;margin:0 0 16px">
    Button not working? Copy and paste this link into your browser:<br>
    <a href="${href}" style="color:#333a8b;word-break:break-all">${href}</a>
  </p>`;
}

function infoBox(text: string): string {
  return `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:16px 0">
    <p style="color:#1e40af;font-size:14px;line-height:1.6;margin:0">${text}</p>
  </div>`;
}

// ─── Result type ──────────────────────────────────────────────────────────────

interface EmailResult {
  success: boolean;
  messageId?: string;
}

// ─── 1. Survey Invite ─────────────────────────────────────────────────────────

export interface SendSurveyInviteParams {
  toEmail: string;
  toName: string;
  companyName: string;
  surveyLink: string;
  expiryDate: string;
  templateId?: number;
}

export async function sendSurveyInvite(params: SendSurveyInviteParams): Promise<EmailResult> {
  const { toEmail, toName, companyName, surveyLink, expiryDate } = params;

  // Always use self-built htmlContent so the survey link is directly embedded
  // in the email HTML. Brevo template IDs are intentionally not used here —
  // templates require {{ params.surveyLink }} to be wired up in the Brevo
  // dashboard, which is error-prone and would break the button silently.
  const htmlContent = emailWrap(
    h2(`ESG Materiality Survey Invitation`) +
    p(`Dear ${toName},`) +
    p(
      `<strong>${companyName}</strong> has invited you to participate in their ESG Double ` +
      `Materiality Assessment. Your responses will help identify the sustainability topics ` +
      `that matter most to the business and its stakeholders.`
    ) +
    ctaButton(surveyLink, "Start Survey →") +
    infoBox("The survey takes approximately 10–15 minutes to complete.") +
    small(`This link expires on <strong>${expiryDate}</strong>. Do not share it — it is unique to you.`)
  );

  console.log(`[brevo] sendSurveyInvite → ${toEmail} | link: ${surveyLink}`);

  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      to: [{ email: toEmail, name: toName }],
      sender: SENDER,
      subject: `You're invited: ${companyName} ESG Materiality Survey`,
      htmlContent,
    });

    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error("[brevo/sendSurveyInvite]", err);
    return { success: false };
  }
}

// ─── 2. Survey Reminder ───────────────────────────────────────────────────────

export interface SendSurveyReminderParams {
  toEmail: string;
  toName: string;
  companyName: string;
  surveyLink: string;
  expiryDate: string;
  reminderNumber: 1 | 2 | 3;
  daysRemaining: number;
  templateId?: number;
}

export async function sendSurveyReminder(params: SendSurveyReminderParams): Promise<EmailResult> {
  const { toEmail, toName, companyName, surveyLink, expiryDate, reminderNumber, daysRemaining } =
    params;

  const subjects: Record<1 | 2 | 3, string> = {
    1: `Reminder: ${companyName} ESG Survey awaits your response`,
    2: `2nd Reminder: Only ${daysRemaining} days left — ${companyName} ESG Survey`,
    3: `Final Reminder: ${companyName} ESG Survey closes in ${daysRemaining} days`,
  };

  const urgencyLines: Record<1 | 2 | 3, string> = {
    1: `This is a friendly reminder to complete the survey for <strong>${companyName}</strong>. Your input is important for their sustainability reporting.`,
    2: `Only <strong>${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remain</strong> to submit your response for <strong>${companyName}</strong>'s ESG Materiality Assessment. Please take a moment to complete it.`,
    3: `<strong>This is the final reminder.</strong> The survey for <strong>${companyName}</strong> closes in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}. Your response is still needed.`,
  };

  // Always use self-built htmlContent — same reasoning as sendSurveyInvite.
  const htmlContent = emailWrap(
    h2(subjects[reminderNumber]) +
    p(`Dear ${toName},`) +
    p(urgencyLines[reminderNumber]) +
    ctaButton(surveyLink, "Complete Survey →", reminderNumber === 3 ? "#dc2626" : "#ff6900") +
    small(`Survey link expires: <strong>${expiryDate}</strong>. This link is unique to you — do not share it.`)
  );

  console.log(`[brevo] sendSurveyReminder #${reminderNumber} → ${toEmail} | link: ${surveyLink}`);

  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      to: [{ email: toEmail, name: toName }],
      sender: SENDER,
      subject: subjects[reminderNumber],
      htmlContent,
    });

    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error("[brevo/sendSurveyReminder]", err);
    return { success: false };
  }
}

// ─── 3. Assessment Complete (notify company admin) ────────────────────────────

export interface SendAssessmentCompleteParams {
  toEmail: string;
  toName: string;
  companyName: string;
  fyYear: string;
  totalStakeholders: number;
  resultsLink: string;
}

export async function sendAssessmentComplete(
  params: SendAssessmentCompleteParams
): Promise<EmailResult> {
  const { toEmail, toName, companyName, fyYear, totalStakeholders, resultsLink } = params;

  const templateId = process.env.BREVO_TEMPLATE_ASSESSMENT_COMPLETE
    ? Number(process.env.BREVO_TEMPLATE_ASSESSMENT_COMPLETE)
    : undefined;

  if (!templateId) {
    console.log(`[brevo/stub] sendAssessmentComplete → ${toEmail} | ${companyName} FY ${fyYear}`);
  }

  try {
    const htmlContent = emailWrap(
      h2(`✅ Assessment Complete — ${companyName} FY ${fyYear}`) +
      p(`Dear ${toName},`) +
      p(
        `All <strong>${totalStakeholders} stakeholder${totalStakeholders !== 1 ? "s" : ""}</strong> have submitted their responses ` +
        `for <strong>${companyName}</strong>'s FY ${fyYear} ESG Double Materiality Assessment. ` +
        `Your materiality matrix is ready to review.`
      ) +
      ctaButton(resultsLink, "View Results →", "#333a8b") +
      small("Log in to the Swifora DMA Platform to review the scores and finalize your assessment.")
    );

    const result = await brevo.transactionalEmails.sendTransacEmail(
      templateId
        ? {
            to: [{ email: toEmail, name: toName }],
            templateId,
            params: { toName, companyName, fyYear, totalStakeholders, resultsLink },
          }
        : {
            to: [{ email: toEmail, name: toName }],
            sender: SENDER,
            subject: `✅ All responses received — ${companyName} FY ${fyYear} Assessment Complete`,
            htmlContent,
          }
    );

    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error("[brevo/sendAssessmentComplete]", err);
    return { success: false };
  }
}

// ─── 4. Welcome Email (new company admin) ─────────────────────────────────────

export interface SendWelcomeEmailParams {
  toEmail: string;
  toName: string;
  companyName: string;
  loginLink: string;
}

export async function sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<EmailResult> {
  const { toEmail, toName, companyName, loginLink } = params;

  const templateId = process.env.BREVO_TEMPLATE_WELCOME
    ? Number(process.env.BREVO_TEMPLATE_WELCOME)
    : undefined;

  if (!templateId) {
    console.log(`[brevo/stub] sendWelcomeEmail → ${toEmail} | ${companyName}`);
  }

  try {
    const htmlContent = emailWrap(
      h2(`Welcome to Swifora DMA Platform`) +
      p(`Dear ${toName},`) +
      p(
        `Your company <strong>${companyName}</strong> has been registered on the Swifora ` +
        `Double Materiality Assessment Platform. You can now create assessments, manage ` +
        `stakeholders, and generate your materiality matrix.`
      ) +
      ctaButton(loginLink, "Go to Dashboard →", "#333a8b") +
      infoBox(
        "Start by creating a new assessment: select your financial year, choose GRI topics, " +
        "add stakeholders, and launch your survey."
      ) +
      small("If you have any questions, contact your Swifora account manager.")
    );

    const result = await brevo.transactionalEmails.sendTransacEmail(
      templateId
        ? {
            to: [{ email: toEmail, name: toName }],
            templateId,
            params: { toName, companyName, loginLink },
          }
        : {
            to: [{ email: toEmail, name: toName }],
            sender: SENDER,
            subject: `Welcome to Swifora DMA Platform — ${companyName}`,
            htmlContent,
          }
    );

    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error("[brevo/sendWelcomeEmail]", err);
    return { success: false };
  }
}
