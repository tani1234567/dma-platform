import { type NextRequest } from "next/server";
import ExcelJS from "exceljs";
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
  permanentEmployees?: EmployeeTableDoc;
  contractEmployees?: EmployeeTableDoc;
}

interface AgeGroupDoc {
  staff?: number;
  operations?: number;
  marketing?: number;
}

interface GenderRowDoc {
  age1830?: AgeGroupDoc;
  age3140?: AgeGroupDoc;
  age4150?: AgeGroupDoc;
  age5160?: AgeGroupDoc;
}

interface EmployeeTableDoc {
  male?: GenderRowDoc;
  female?: GenderRowDoc;
  transgender?: GenderRowDoc;
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
  quadrant: string;
  respondentCount: number;
  comments: string[];
}

interface ScoresDoc {
  topicScores: Record<string, TopicScoreEntry>;
  totalResponses: number;
}

interface StakeholderDoc {
  type: string;
  status: string;
}

interface GRITopicDoc {
  code: string;
  name: string;
  pillarCode: string;
}

interface RatingEntry {
  impact: number;
  financial: number;
  comment?: string;
}

interface ResponseDoc {
  stakeholderType: string;
  weight: number;
  ratings: Record<string, RatingEntry>;
  isProxySubmission?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BLUE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF333A8B" },
};

const ALT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFEFF2FF" },
};

const WHITE_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };

const QUADRANT_COLORS: Record<string, string> = {
  critical:  "FF991B1B",
  important: "FF9A3412",
  consider:  "FF1E40AF",
  monitor:   "FF6B7280",
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

function sumAgeGroup(ag: AgeGroupDoc | undefined): number {
  if (!ag) return 0;
  return (ag.staff ?? 0) + (ag.operations ?? 0) + (ag.marketing ?? 0);
}

function sumGenderRow(row: GenderRowDoc | undefined): number {
  if (!row) return 0;
  return (
    sumAgeGroup(row.age1830) +
    sumAgeGroup(row.age3140) +
    sumAgeGroup(row.age4150) +
    sumAgeGroup(row.age5160)
  );
}

function sumEmployeeTable(table: EmployeeTableDoc | undefined): number {
  if (!table) return 0;
  return (
    sumGenderRow(table.male) +
    sumGenderRow(table.female) +
    sumGenderRow(table.transgender)
  );
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell(cell => {
    cell.fill  = BLUE_FILL;
    cell.font  = WHITE_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 22;
}

function styleAltRows(sheet: ExcelJS.Worksheet, startRow: number): void {
  for (let i = startRow; i <= sheet.rowCount; i++) {
    if (i % 2 !== 0) continue; // shade even data rows
    sheet.getRow(i).eachCell({ includeEmpty: false }, cell => {
      cell.fill = ALT_FILL;
    });
  }
}

// ─── Excel builder ────────────────────────────────────────────────────────────

async function buildExcel(
  company: CompanyDoc,
  assessment: AssessmentDoc,
  scores: ScoresDoc,
  stakeholders: StakeholderDoc[],
  responses: ResponseDoc[],
  griTopics: Map<string, GRITopicDoc>,
  fyId: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator   = "Swifora DMA Platform";
  workbook.lastModifiedBy = "Swifora DMA Platform";
  workbook.created   = new Date();
  workbook.modified  = new Date();

  const topicEntries = Object.entries(scores.topicScores)
    .map(([code, score]) => ({ code, score }))
    .sort((a, b) => b.score.combinedScore - a.score.combinedScore);

  // ── SHEET 1: SCORES ──────────────────────────────────────────────────────────

  const sheet1 = workbook.addWorksheet("Scores");
  sheet1.columns = [
    { header: "Rank",            key: "rank",       width: 8  },
    { header: "Topic Code",      key: "code",       width: 14 },
    { header: "Topic Name",      key: "name",       width: 44 },
    { header: "Pillar",          key: "pillar",     width: 14 },
    { header: "Impact Score",    key: "impact",     width: 16 },
    { header: "Financial Score", key: "financial",  width: 18 },
    { header: "Combined Score",  key: "combined",   width: 18 },
    { header: "Quadrant",        key: "quadrant",   width: 16 },
    { header: "Respondents",     key: "respondents",width: 16 },
  ];

  topicEntries.forEach(({ code, score }, i) => {
    const pillar = code[0] ?? "?";
    const pillarLabel =
      pillar === "E" ? "Environmental" :
      pillar === "S" ? "Social" :
      pillar === "G" ? "Governance" : pillar;

    const row = sheet1.addRow({
      rank:        i + 1,
      code,
      name:        griTopics.get(code)?.name ?? code,
      pillar:      pillarLabel,
      impact:      score.impactScore,
      financial:   score.financialScore,
      combined:    score.combinedScore,
      quadrant:    score.quadrant.charAt(0).toUpperCase() + score.quadrant.slice(1),
      respondents: score.respondentCount,
    });

    // Colour-code the Quadrant cell
    const qColor = QUADRANT_COLORS[score.quadrant];
    if (qColor) {
      const qCell = row.getCell("quadrant");
      qCell.font = { color: { argb: qColor }, bold: true };
    }

    // Center numeric cells
    (["rank", "impact", "financial", "combined", "respondents"] as const).forEach(k => {
      row.getCell(k).alignment = { horizontal: "center" };
    });
  });

  styleHeaderRow(sheet1.getRow(1));
  styleAltRows(sheet1, 2);

  // ── SHEET 2: STAKEHOLDER BREAKDOWN ──────────────────────────────────────────

  const sheet2 = workbook.addWorksheet("Stakeholder Breakdown");

  // Collect per-type average impact scores per topic
  const typeImpact = new Map<string, Map<string, number[]>>();
  for (const response of responses) {
    const t = response.stakeholderType;
    if (!typeImpact.has(t)) typeImpact.set(t, new Map());
    const tm = typeImpact.get(t)!;
    for (const [code, rating] of Object.entries(response.ratings)) {
      if (!tm.has(code)) tm.set(code, []);
      tm.get(code)!.push(rating.impact);
    }
  }

  const uniqueTypes = Array.from(typeImpact.keys()).sort();

  sheet2.columns = [
    { header: "Topic Code", key: "code", width: 14 },
    { header: "Topic Name", key: "name", width: 44 },
    ...uniqueTypes.map(type => ({ header: type, key: type, width: 20 })),
  ];

  for (const { code } of topicEntries) {
    const rowData: Record<string, string | number> = {
      code,
      name: griTopics.get(code)?.name ?? code,
    };
    for (const type of uniqueTypes) {
      const vals = typeImpact.get(type)?.get(code) ?? [];
      if (vals.length > 0) {
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        rowData[type] = Math.round(avg * 100) / 100;
      } else {
        rowData[type] = "";
      }
    }
    const row = sheet2.addRow(rowData);
    // Center type columns
    uniqueTypes.forEach(type => {
      row.getCell(type).alignment = { horizontal: "center" };
    });
  }

  styleHeaderRow(sheet2.getRow(1));
  styleAltRows(sheet2, 2);

  // ── SHEET 3: RAW RESPONSES (ANONYMISED) ───────────────────────────────────────

  const sheet3 = workbook.addWorksheet("Raw Responses");
  sheet3.columns = [
    { header: "Response #",       key: "resp",      width: 14 },
    { header: "Stakeholder Type", key: "type",      width: 22 },
    { header: "Topic Code",       key: "code",      width: 14 },
    { header: "Topic Name",       key: "name",      width: 44 },
    { header: "Impact Rating",    key: "impact",    width: 16 },
    { header: "Financial Rating", key: "financial", width: 18 },
    { header: "Comment",          key: "comment",   width: 50 },
  ];

  let rowIdx = 1;
  for (const response of responses) {
    for (const [code, rating] of Object.entries(response.ratings)) {
      const row = sheet3.addRow({
        resp:      rowIdx++,
        type:      response.stakeholderType,
        code,
        name:      griTopics.get(code)?.name ?? code,
        impact:    rating.impact,
        financial: rating.financial,
        comment:   rating.comment ?? "",
      });
      row.getCell("resp").alignment    = { horizontal: "center" };
      row.getCell("impact").alignment  = { horizontal: "center" };
      row.getCell("financial").alignment = { horizontal: "center" };
    }
  }

  styleHeaderRow(sheet3.getRow(1));
  styleAltRows(sheet3, 2);

  // ── SHEET 4: COMPANY PROFILE ──────────────────────────────────────────────────

  const sheet4 = workbook.addWorksheet("Company Profile");
  sheet4.columns = [
    { header: "Field", key: "field", width: 40 },
    { header: "Value", key: "value", width: 55 },
  ];

  const profileRows: [string, string | number][] = [
    ["Company Name",                   company.name],
    ["CIN Number",                     company.cinNumber                  ?? "—"],
    ["Industry",                       company.industry                   ?? "—"],
    ["Address",                        company.address                    ?? "—"],
    ["Country",                        company.country                    ?? "—"],
    ["Manufacturing Unit Location",    company.manufacturingUnitLocation  ?? "—"],
    ["Area of Manufacturing Unit",
      company.areaOfManufacturingUnit
        ? `${company.areaOfManufacturingUnit} ${company.areaUnit ?? ""}`
        : "—"],
    ["Total Water Usage (Last FY)",
      company.totalWaterUsage_FY !== undefined
        ? `${company.totalWaterUsage_FY} m³`
        : "—"],
    ["Total Electricity Consumption (Last FY)",
      company.totalElectricityConsumption_FY !== undefined
        ? `${company.totalElectricityConsumption_FY} kWh`
        : "—"],
    ["Total Fuel Consumption (Last FY)",
      company.totalFuelConsumption_FY !== undefined
        ? `${company.totalFuelConsumption_FY} ${company.fuelUnit ?? ""}`
        : "—"],
    ["Total Permanent Employees",      sumEmployeeTable(company.permanentEmployees)],
    ["Total Contract Employees",       sumEmployeeTable(company.contractEmployees)],
    ["Financial Year",                 assessment.financialYear],
    ["Total Stakeholders",             assessment.stakeholderCount ?? stakeholders.length],
    ["Total Responses",                scores.totalResponses],
    ["Topics in Assessment",           topicEntries.length],
  ];

  profileRows.forEach(([field, value]) => {
    sheet4.addRow({ field, value });
  });

  styleHeaderRow(sheet4.getRow(1));

  // Bold the Field column
  for (let i = 2; i <= sheet4.rowCount; i++) {
    const row = sheet4.getRow(i);
    row.getCell("field").font = { bold: true };
    if (i % 2 === 0) {
      row.getCell("field").fill = ALT_FILL;
      row.getCell("value").fill = ALT_FILL;
    }
  }

  // Produce buffer
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

// ─── POST /api/reports/excel ──────────────────────────────────────────────────

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
      responseSnap,
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
      adminDb.collection("companies").doc(companyId)
        .collection("assessments").doc(fyId)
        .collection("responses").get(),
      adminDb.collection("gri_topics").get(),
    ]);

    if (!companySnap.exists)
      return errRes("not_found", "Company not found.", 404);
    if (!assessmentSnap.exists)
      return errRes("not_found", "Assessment not found.", 404);
    if (!scoresSnap.exists)
      return errRes("not_found", "Scores not calculated yet. Please recalculate.", 404);

    const company      = companySnap.data() as CompanyDoc;
    const assessment   = assessmentSnap.data() as AssessmentDoc;
    const scores       = scoresSnap.data() as ScoresDoc;
    const stakeholders = stakeholderSnap.docs.map(d => d.data() as StakeholderDoc);
    const responses    = responseSnap.docs.map(d => d.data() as ResponseDoc);

    const griTopics = new Map<string, GRITopicDoc>();
    for (const d of topicsSnap.docs) {
      const t = d.data() as GRITopicDoc;
      griTopics.set(t.code, t);
    }

    // Build Excel
    const xlsBuffer = await buildExcel(
      company, assessment, scores, stakeholders, responses, griTopics, fyId
    );

    // Upload to Firebase Storage
    const bucket   = adminStorage.bucket();
    const filePath = `reports/${companyId}/${fyId}/materiality-data-${fyId}.xlsx`;
    const file     = bucket.file(filePath);

    await file.save(xlsBuffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      resumable: false,
    });

    const [downloadUrl] = await file.getSignedUrl({
      action:  "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return Response.json({ success: true, downloadUrl });
  } catch (error) {
    console.error("[reports/excel POST]", error);
    return Response.json(
      { error: "server_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
