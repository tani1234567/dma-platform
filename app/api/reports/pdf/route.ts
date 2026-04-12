import { type NextRequest } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { adminDb, adminStorage } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

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
  totalWaterUsage_FY?: number;
  totalElectricityConsumption_FY?: number;
  totalFuelConsumption_FY?: number;
  fuelUnit?: string;
}

interface AssessmentDoc {
  financialYear: string;
  selectedTopics?: string[];
  stakeholderCount?: number;
  responseCount?: number;
}

interface TopicScoreEntry {
  impactScore: number;
  financialScore: number;
  combinedScore: number;
  quadrant: "critical" | "important" | "consider" | "monitor";
  respondentCount: number;
  comments: string[];
}

interface ScoresDoc {
  topicScores: Record<string, TopicScoreEntry>;
  totalResponses: number;
  impactThreshold: number;
  financialThreshold: number;
}

interface StakeholderDoc {
  type: string;
  status: string;
  isProxySubmission?: boolean;
}

interface GRITopicDoc {
  code: string;
  name: string;
  pillarCode: string;
}

interface ReportData {
  company: CompanyDoc;
  assessment: AssessmentDoc;
  scores: ScoresDoc;
  stakeholders: StakeholderDoc[];
  griTopics: Map<string, GRITopicDoc>;
  fyId: string;
  companyId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_BLUE   = "#333a8b"; // also [51, 58, 139]
const BRAND_ORANGE = "#ff6900"; // also [255, 105, 0]

const QUADRANT_COLORS: Record<string, string> = {
  critical:  "#991b1b",
  important: "#9a3412",
  consider:  "#1e40af",
  monitor:   "#6b7280",
};

const QUADRANT_LABELS: Record<string, string> = {
  critical:  "Critical",
  important: "Important",
  consider:  "Consider",
  monitor:   "Monitor",
};

const QUADRANT_DESCRIPTIONS: Record<string, string> = {
  critical:  "Highest priority — material to both impact and financial perspectives.",
  important: "High environmental or social impact; lower direct financial materiality.",
  consider:  "High financial relevance; lower direct impact. Monitor closely.",
  monitor:   "Lower priority for current reporting cycle. Monitor for future changes.",
};

const QUADRANT_CRITERIA: Record<string, string> = {
  critical:  "High Impact + High Financial",
  important: "High Impact + Low Financial",
  consider:  "Low Impact + High Financial",
  monitor:   "Low Impact + Low Financial",
};

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

function addPageFooter(doc: jsPDF, pageWidth: number, pageHeight: number): void {
  doc.setFontSize(8);
  doc.setTextColor("#b4b9dc");
  doc.text("Swifora DMA Platform · Confidential", pageWidth / 2, pageHeight - 8, {
    align: "center",
  });
}

function addSectionHeading(
  doc: jsPDF,
  title: string,
  y: number,
  marginLeft: number,
  usableWidth: number
): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(BRAND_BLUE);
  doc.text(title, marginLeft, y);

  doc.setDrawColor(BRAND_BLUE);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y + 5, marginLeft + usableWidth, y + 5);
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

function buildPdf(data: ReportData): Buffer {
  const { company, assessment, scores, stakeholders, griTopics, fyId } = data;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210;
  const PH = 297;
  const ML = 15;
  const MR = 15;
  const UW = PW - ML - MR; // 180mm

  // Sort topics by combined score desc
  const topicEntries = Object.entries(scores.topicScores)
    .map(([code, score]) => ({ code, score }))
    .sort((a, b) => b.score.combinedScore - a.score.combinedScore);

  const totalResponses  = scores.totalResponses;
  const stakeholderCount = assessment.stakeholderCount ?? stakeholders.length;
  const responseCount   = assessment.responseCount ?? totalResponses;
  const topicsAssessed  = topicEntries.length;
  const criticalTopics  = topicEntries.filter(e => e.score.quadrant === "critical");
  const pct = stakeholderCount > 0
    ? Math.round((responseCount / stakeholderCount) * 100)
    : 0;
  const fyYear = assessment.financialYear;
  const generatedDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // ── PAGE 1: COVER ────────────────────────────────────────────────────────────

  doc.setFillColor(BRAND_BLUE);
  doc.rect(0, 0, PW, PH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor("#ffffff");
  doc.text("Swifora", ML, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor("#b4b9dc");
  doc.text("DMA Platform", ML, 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor("#ffffff");
  doc.text(company.name, PW / 2, 128, { align: "center", maxWidth: 170 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor("#c8cceb");
  doc.text("ESG Double Materiality Assessment Report", PW / 2, 146, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor("#b4b9dc");
  doc.text(`Financial Year: ${fyYear}`, PW / 2, 160, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Generated: ${generatedDate}`, PW / 2, 170, { align: "center" });

  doc.setFillColor(BRAND_ORANGE);
  doc.rect(0, PH - 22, PW, 22, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#ffffff");
  doc.text("Powered by Swifora · sowin.world", PW / 2, PH - 9, { align: "center" });

  // ── PAGE 2: EXECUTIVE SUMMARY ─────────────────────────────────────────────────

  doc.addPage();
  addSectionHeading(doc, "Executive Summary", 20, ML, UW);

  // Stat boxes (4 across, 42mm each, 4mm gap)
  const boxW = 42;
  const boxH = 28;
  const boxY = 32;
  const statBoxes = [
    { label: "Topics Assessed",  value: String(topicsAssessed) },
    { label: "Total Responses",  value: String(totalResponses) },
    { label: "Response Rate",    value: `${pct}%` },
    { label: "Critical Topics",  value: String(criticalTopics.length) },
  ];

  statBoxes.forEach((box, i) => {
    const x = ML + i * (boxW + 4);
    doc.setFillColor("#eff2ff");
    doc.setDrawColor(BRAND_BLUE);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, boxY, boxW, boxH, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor("#6b7280");
    doc.text(box.label, x + boxW / 2, boxY + 9, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(BRAND_BLUE);
    doc.text(box.value, x + boxW / 2, boxY + 22, { align: "center" });
  });

  // Summary paragraph
  const summaryText =
    `This report presents the results of ${company.name}'s Double Materiality Assessment ` +
    `for FY ${fyYear}. A total of ${totalResponses} stakeholder` +
    `${totalResponses !== 1 ? "s" : ""} participated, rating ${topicsAssessed} ESG topics ` +
    `across Environmental, Social, and Governance pillars.`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor("#1e1e1e");
  const summaryLines = doc.splitTextToSize(summaryText, UW);
  doc.text(summaryLines, ML, 74);

  const critHeadY = 74 + summaryLines.length * 6 + 8;

  // Top 5 critical topics
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(BRAND_BLUE);
  doc.text("Top Critical Topics", ML, critHeadY);

  doc.setFontSize(10);

  if (criticalTopics.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor("#6b7280");
    doc.text("No critical topics identified in this assessment.", ML, critHeadY + 8);
  } else {
    const top5 = criticalTopics.slice(0, 5);
    top5.forEach((entry, i) => {
      const y = critHeadY + 8 + i * 9;
      const name = griTopics.get(entry.code)?.name ?? entry.code;
      const nameShort = name.length > 48 ? name.substring(0, 46) + "…" : name;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(QUADRANT_COLORS.critical);
      doc.text(`${i + 1}.`, ML, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor("#1e1e1e");
      doc.text(`${entry.code} — ${nameShort}`, ML + 7, y);

      doc.setTextColor("#6b7280");
      doc.text(`${entry.score.combinedScore.toFixed(2)} / 5`, PW - MR, y, { align: "right" });
    });
  }

  addPageFooter(doc, PW, PH);

  // ── PAGE 3: MATERIALITY MATRIX OVERVIEW ───────────────────────────────────────

  doc.addPage();
  addSectionHeading(doc, "Materiality Matrix Overview", 20, ML, UW);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor("#6b7280");
  doc.text(
    "For the interactive visual matrix, please refer to the platform dashboard.",
    ML, 33
  );

  const qCounts: Record<string, number> = {
    critical: 0, important: 0, consider: 0, monitor: 0,
  };
  for (const { score } of topicEntries) {
    if (score.quadrant in qCounts) qCounts[score.quadrant]++;
  }

  const quadrantTableRows = (["critical", "important", "consider", "monitor"] as const).map(q => [
    QUADRANT_LABELS[q],
    QUADRANT_CRITERIA[q],
    String(qCounts[q]),
    QUADRANT_DESCRIPTIONS[q],
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Quadrant", "Criteria", "Topics", "Description"]],
    body: quadrantTableRows,
    headStyles: {
      fillColor: BRAND_BLUE,
      textColor: "#ffffff",
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, cellPadding: 4 },
    alternateRowStyles: { fillColor: "#f8faff" },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 26 },
      1: { cellWidth: 50 },
      2: { halign: "center", cellWidth: 18 },
      3: { cellWidth: 82 },
    },
    margin: { left: ML, right: MR },
    theme: "plain",
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 0) {
        const label = String(hookData.cell.raw).toLowerCase();
        if (label in QUADRANT_COLORS) hookData.cell.styles.textColor = QUADRANT_COLORS[label];
      }
    },
    didDrawPage: () => addPageFooter(doc, PW, PH),
  });

  // ── PAGE 4: FULL SCORES TABLE ─────────────────────────────────────────────────

  doc.addPage();
  addSectionHeading(doc, "Topic-by-Topic Materiality Scores", 20, ML, UW);

  const scoreTableRows = topicEntries.map((entry, i) => [
    String(i + 1),
    entry.code,
    (() => {
      const n = griTopics.get(entry.code)?.name ?? entry.code;
      return n.length > 38 ? n.substring(0, 36) + "…" : n;
    })(),
    entry.code[0] ?? "?",
    entry.score.impactScore.toFixed(2),
    entry.score.financialScore.toFixed(2),
    entry.score.combinedScore.toFixed(2),
    QUADRANT_LABELS[entry.score.quadrant] ?? entry.score.quadrant,
    String(entry.score.respondentCount),
  ]);

  autoTable(doc, {
    startY: 30,
    head: [["#", "Code", "Topic Name", "P", "Impact", "Financial", "Combined", "Quadrant", "n"]],
    body: scoreTableRows,
    headStyles: {
      fillColor: BRAND_BLUE,
      textColor: "#ffffff",
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: "#f8faff" },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 13, fontStyle: "bold" },
      2: { cellWidth: 54 },
      3: { halign: "center", cellWidth: 8 },
      4: { halign: "center", cellWidth: 18 },
      5: { halign: "center", cellWidth: 20 },
      6: { halign: "center", cellWidth: 20 },
      7: { cellWidth: 24 },
      8: { halign: "center", cellWidth: 10 },
    },
    margin: { left: ML, right: MR },
    theme: "plain",
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 7) {
        const label = String(hookData.cell.raw).toLowerCase();
        if (label in QUADRANT_COLORS) hookData.cell.styles.textColor = QUADRANT_COLORS[label];
      }
    },
    didDrawPage: () => addPageFooter(doc, PW, PH),
  });

  // ── PAGE 5: STAKEHOLDER PARTICIPATION ─────────────────────────────────────────

  doc.addPage();
  addSectionHeading(doc, "Stakeholder Participation Summary", 20, ML, UW);

  const typeAgg = new Map<string, { total: number; responded: number }>();
  let hasProxy = false;
  for (const s of stakeholders) {
    if (!typeAgg.has(s.type)) typeAgg.set(s.type, { total: 0, responded: 0 });
    const e = typeAgg.get(s.type)!;
    e.total++;
    if (s.status === "completed") e.responded++;
    if (s.isProxySubmission) hasProxy = true;
  }

  const participationRows = Array.from(typeAgg.entries()).map(([type, d]) => [
    type,
    String(d.total),
    String(d.responded),
    `${d.total > 0 ? Math.round((d.responded / d.total) * 100) : 0}%`,
  ]);

  autoTable(doc, {
    startY: 30,
    head: [["Stakeholder Type", "Added", "Responded", "Response Rate"]],
    body: participationRows,
    headStyles: {
      fillColor: BRAND_BLUE,
      textColor: "#ffffff",
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, cellPadding: 5 },
    alternateRowStyles: { fillColor: "#f8faff" },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
    },
    margin: { left: ML, right: MR },
    theme: "plain",
    didDrawPage: () => addPageFooter(doc, PW, PH),
  });

  if (hasProxy) {
    const lastTbl = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    const noteY = (lastTbl?.finalY ?? 100) + 8;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor("#6b7280");
    doc.text(
      "Note: Some responses were submitted by proxy on behalf of stakeholders.",
      ML, noteY
    );
  }

  // ── PAGE 6: COMMENTS APPENDIX ─────────────────────────────────────────────────

  doc.addPage();
  addSectionHeading(doc, "Appendix A: Stakeholder Comments", 20, ML, UW);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor("#6b7280");
  doc.text(
    "Comments have been anonymised. Stakeholder identities are not disclosed.",
    ML, 32
  );

  const topicsWithComments = topicEntries.filter(e => e.score.comments.length > 0);

  if (topicsWithComments.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor("#6b7280");
    doc.text("No comments were provided for this assessment.", ML, 44);
    addPageFooter(doc, PW, PH);
  } else {
    let curY = 42;

    for (const entry of topicsWithComments) {
      if (curY > PH - 35) {
        doc.addPage();
        addPageFooter(doc, PW, PH);
        curY = 20;
      }

      const topicName = griTopics.get(entry.code)?.name ?? entry.code;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(BRAND_BLUE);
      doc.text(`${entry.code} — ${topicName}`, ML, curY);
      curY += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor("#1e1e1e");

      for (const comment of entry.score.comments) {
        if (curY > PH - 30) {
          doc.addPage();
          addPageFooter(doc, PW, PH);
          curY = 20;
        }
        const wrapped = doc.splitTextToSize(`• ${comment}`, UW - 6);
        doc.text(wrapped, ML + 4, curY);
        curY += wrapped.length * 5.5 + 2;
      }
      curY += 5;
    }

    addPageFooter(doc, PW, PH);
  }

  // PDF → Node Buffer
  return Buffer.from(doc.output("arraybuffer"));
}

// ─── POST /api/reports/pdf ────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Auth
    const sessionUid = request.cookies.get("__session")?.value;
    const claimsRaw  = request.cookies.get("__claims")?.value;
    if (!sessionUid || !claimsRaw)
      return errRes("unauthorized", "Authentication required.", 401);
    const claims = parseClaims(claimsRaw);
    if (!claims || claims.role !== "company_admin")
      return errRes("forbidden", "Company admin access required.", 403);

    // Parse body
    let body: { companyId: string; fyId: string };
    try {
      body = (await request.json()) as { companyId: string; fyId: string };
    } catch {
      return errRes("bad_request", "Invalid request body.", 400);
    }
    const { companyId, fyId } = body;
    if (!companyId || !fyId)
      return errRes("bad_request", "companyId and fyId are required.", 400);
    if (claims.uid !== companyId)
      return errRes("forbidden", "Access denied for this company.", 403);

    // Fetch all data in parallel
    const [
      companySnap,
      assessmentSnap,
      scoresSnap,
      stakeholderSnap,
      topicsSnap,
    ] = await Promise.all([
      adminDb.collection("companies").doc(companyId).get(),
      adminDb.collection("companies").doc(companyId)
        .collection("assessments").doc(fyId).get(),
      adminDb.collection("companies").doc(companyId)
        .collection("assessments").doc(fyId)
        .collection("scores").doc("main").get(),
      adminDb.collection("companies").doc(companyId)
        .collection("assessments").doc(fyId)
        .collection("stakeholders").get(),
      adminDb.collection("gri_topics").get(),
    ]);

    if (!companySnap.exists)
      return errRes("not_found", "Company not found.", 404);
    if (!assessmentSnap.exists)
      return errRes("not_found", "Assessment not found.", 404);
    if (!scoresSnap.exists)
      return errRes("not_found", "Scores not calculated yet. Please recalculate.", 404);

    const company     = companySnap.data() as CompanyDoc;
    const assessment  = assessmentSnap.data() as AssessmentDoc;
    const scores      = scoresSnap.data() as ScoresDoc;
    const stakeholders = stakeholderSnap.docs.map(d => d.data() as StakeholderDoc);

    const griTopics = new Map<string, GRITopicDoc>();
    for (const d of topicsSnap.docs) {
      const t = d.data() as GRITopicDoc;
      griTopics.set(t.code, t);
    }

    // Build PDF
    const pdfBuffer = buildPdf({
      company, assessment, scores, stakeholders, griTopics, fyId, companyId,
    });

    // Upload to Firebase Storage
    const bucket   = adminStorage.bucket();
    const filePath = `reports/${companyId}/${fyId}/materiality-report-${fyId}.pdf`;
    const file     = bucket.file(filePath);

    await file.save(pdfBuffer, {
      contentType: "application/pdf",
      resumable: false,
    });

    const [downloadUrl] = await file.getSignedUrl({
      action:  "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return Response.json({ success: true, downloadUrl });
  } catch (error) {
    console.error("[reports/pdf POST]", error);
    return Response.json(
      { error: "server_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
