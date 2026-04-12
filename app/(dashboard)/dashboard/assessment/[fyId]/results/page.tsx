"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, ChevronDown, ChevronUp, Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAssessment,
  getGRITopics,
  getScores,
  getStakeholders,
} from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import MaterialityMatrix from "@/components/charts/MaterialityMatrix";
import {
  Assessment,
  AssessmentStatus,
  GRITopic,
  QuadrantType,
  ScoreDocument,
  Stakeholder,
  SurveyTokenStatus,
  TopicScore,
} from "@/types";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const PILLAR: Record<string, {
  label: string; short: string; bg: string; color: string; borderColor: string;
}> = {
  E: { label: "Environmental", short: "Env", bg: "#dcfce7", color: "#166534", borderColor: "#16a34a" },
  S: { label: "Social",        short: "Soc", bg: "#dbeafe", color: "#1e40af", borderColor: "#3b82f6" },
  G: { label: "Governance",    short: "Gov", bg: "#ffedd5", color: "#9a3412", borderColor: "#f97316" },
};

const QUADRANT_BADGE: Record<QuadrantType, { label: string; bg: string; color: string }> = {
  critical:  { label: "Critical",  bg: "#fee2e2", color: "#991b1b" },
  important: { label: "Important", bg: "#ffedd5", color: "#9a3412" },
  consider:  { label: "Consider",  bg: "#dbeafe", color: "#1e40af" },
  monitor:   { label: "Monitor",   bg: "#f3f4f6", color: "#6b7280" },
};

// ─── Local types ──────────────────────────────────────────────────────────────

type SortCol = "combined" | "impact" | "financial" | "respondents";
type PillarFilter = "ALL" | "E" | "S" | "G";

interface ScoredEntry {
  code: string;
  score: TopicScore;
  topic: GRITopic | undefined;
  pillarCode: string;
}

interface TypeBreakdown {
  type: string;
  total: number;
  responded: number;
  pendingIds: string[];
  uninvitedIds: string[];
  rate: number;
}

interface PillarStat {
  impact: number;
  financial: number;
  combined: number;
  count: number;
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(ts: { toDate(): Date }): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(ts.toDate());
}

function scoreBarColor(score: number): string {
  if (score >= 4) return "#333a8b";
  if (score >= 3) return "#f59e0b";
  return "#9ca3af";
}

function rateTextClass(rate: number): string {
  if (rate >= 80) return "text-green-600";
  if (rate >= 50) return "text-orange-500";
  return "text-red-600";
}

function rateBarClass(rate: number): string {
  if (rate >= 80) return "bg-green-500";
  if (rate >= 50) return "bg-orange-500";
  return "bg-red-500";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-gray-100 animate-pulse rounded-xl", className)} />;
}

function Toast({ message, error }: { message: string; error?: boolean }) {
  return (
    <div className={cn(
      "fixed top-20 right-6 z-50 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg pointer-events-none",
      error ? "bg-red-600" : "bg-gray-900"
    )}>
      {message}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-gray-900 tabular-nums w-9 shrink-0">
        {score.toFixed(2)}
      </span>
      <div className="w-16 h-1.5 bg-gray-100 rounded-full shrink-0">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${(score / 5) * 100}%`, backgroundColor: scoreBarColor(score) }}
        />
      </div>
    </div>
  );
}

function QuadrantBadge({ quadrant }: { quadrant: QuadrantType }) {
  const q = QUADRANT_BADGE[quadrant];
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: q.bg, color: q.color }}>
      {q.label}
    </span>
  );
}

function PillarBadge({ code }: { code: string }) {
  const p = PILLAR[code];
  if (!p) return <span className="text-xs text-gray-400">{code}</span>;
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: p.bg, color: p.color }}>
      {p.short}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { fyId } = useParams<{ fyId: string }>();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [scores, setScores] = useState<ScoreDocument | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [topicMap, setTopicMap] = useState<Map<string, GRITopic>>(new Map());
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [remindingType, setRemindingType] = useState<string | null>(null);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const [sortCol, setSortCol] = useState<SortCol>("combined");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [chartFilter, setChartFilter] = useState<PillarFilter>("ALL");

  const companyId = firebaseUser?.uid ?? "";
  const matrixSvgRef = useRef<SVGSVGElement>(null);
  const [matrixThresholds, setMatrixThresholds] = useState({ impact: 3.0, financial: 3.0 });
  const [highlightedTopic, setHighlightedTopic] = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading || !companyId) return;
    Promise.all([
      getAssessment(companyId, fyId),
      getScores(companyId, fyId),
      getStakeholders(companyId, fyId),
      getGRITopics(),
    ])
      .then(([a, s, sh, topics]) => {
        setAssessment(a);
        setScores(s);
        setStakeholders(sh);
        const map = new Map<string, GRITopic>();
        for (const t of topics) map.set(t.code, t);
        setTopicMap(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading, companyId, fyId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleRecalculate() {
    if (!companyId || recalculating) return;
    setRecalculating(true);
    try {
      const res = await fetch("/api/scores/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, fyId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { topicsScored: number; totalResponses: number };
        setToast({ msg: `Recalculated — ${data.topicsScored} topics scored from ${data.totalResponses} responses.` });
        const newScores = await getScores(companyId, fyId);
        setScores(newScores);
      } else {
        setToast({ msg: "Recalculation failed. Please try again.", error: true });
      }
    } catch {
      setToast({ msg: "Network error.", error: true });
    } finally {
      setRecalculating(false);
    }
  }

  async function handleSendReminders(type: string, ids: string[]) {
    if (!companyId || remindingType) return;
    setRemindingType(type);
    try {
      const res = await fetch("/api/survey/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, fyId, stakeholderIds: ids }),
      });
      const data = (await res.json()) as { remindersSent?: number; message?: string };
      if (res.ok) {
        const n = data.remindersSent ?? 0;
        setToast({ msg: `${n} reminder${n !== 1 ? "s" : ""} sent to ${type}.` });
      } else {
        setToast({ msg: data.message ?? "Failed to send reminders.", error: true });
      }
    } catch {
      setToast({ msg: "Network error.", error: true });
    } finally {
      setRemindingType(null);
    }
  }

  async function handleSendInvites() {
    if (!companyId || sendingInvites) return;
    setSendingInvites(true);
    try {
      const res = await fetch("/api/survey/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, fyId }),
      });
      const data = (await res.json()) as { emailsSent?: number; total?: number; message?: string };
      if (res.ok) {
        const n = data.emailsSent ?? 0;
        setToast({ msg: n === 0 ? "No uninvited stakeholders found." : `${n} invite email${n !== 1 ? "s" : ""} sent.` });
        const [newScores, newStakeholders] = await Promise.all([
          getScores(companyId, fyId),
          getStakeholders(companyId, fyId),
        ]);
        setScores(newScores);
        setStakeholders(newStakeholders);
      } else {
        setToast({ msg: data.message ?? "Failed to send invites.", error: true });
      }
    } catch {
      setToast({ msg: "Network error.", error: true });
    } finally {
      setSendingInvites(false);
    }
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  function computeQuadrant(impact: number, financial: number, it: number, ft: number): QuadrantType {
    if (impact >= it && financial >= ft) return "critical";
    if (impact >= it && financial < ft) return "important";
    if (impact < it && financial >= ft) return "consider";
    return "monitor";
  }

  function downloadMatrix() {
    const svg = matrixSvgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svg.clientWidth || 700;
      canvas.height = svg.clientHeight || 600;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `materiality-matrix-${fyId}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  function handleTopicClick(code: string) {
    setHighlightedTopic(code);
    const row = document.getElementById(`topic-row-${code}`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightedTopic(null), 2000);
  }

  function handleThresholdChange(impact: number, financial: number) {
    setMatrixThresholds({ impact, financial });
  }

  async function handleDownloadPdf() {
    if (!companyId || generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const res = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, fyId }),
      });
      const data = (await res.json()) as { downloadUrl?: string; message?: string };
      if (res.ok && data.downloadUrl) {
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download = `materiality-report-${fyId}.pdf`;
        a.click();
      } else {
        setToast({ msg: data.message ?? "Failed to generate PDF.", error: true });
      }
    } catch {
      setToast({ msg: "Network error generating PDF.", error: true });
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleDownloadExcel() {
    if (!companyId || generatingExcel) return;
    setGeneratingExcel(true);
    try {
      const res = await fetch("/api/reports/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, fyId }),
      });
      const data = (await res.json()) as { downloadUrl?: string; message?: string };
      if (res.ok && data.downloadUrl) {
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download = `materiality-data-${fyId}.xlsx`;
        a.click();
      } else {
        setToast({ msg: data.message ?? "Failed to generate Excel file.", error: true });
      }
    } catch {
      setToast({ msg: "Network error generating Excel.", error: true });
    } finally {
      setGeneratingExcel(false);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const selectedTopics = assessment?.selectedTopics ?? [];
  const responseCount  = assessment?.responseCount ?? 0;
  const totalCount     = assessment?.stakeholderCount ?? 0;
  const pct = totalCount > 0 ? Math.round((responseCount / totalCount) * 100) : 0;

  const sortedTopics = useMemo<ScoredEntry[]>(() => {
    if (!scores) return [];
    return Object.entries(scores.topicScores)
      .map(([code, score]) => ({ code, score, topic: topicMap.get(code), pillarCode: code[0] ?? "E" }))
      .sort((a, b) => {
        const av =
          sortCol === "combined"    ? a.score.combinedScore   :
          sortCol === "impact"      ? a.score.impactScore     :
          sortCol === "financial"   ? a.score.financialScore  :
          a.score.respondentCount;
        const bv =
          sortCol === "combined"    ? b.score.combinedScore   :
          sortCol === "impact"      ? b.score.impactScore     :
          sortCol === "financial"   ? b.score.financialScore  :
          b.score.respondentCount;
        return sortDir === "desc" ? bv - av : av - bv;
      });
  }, [scores, topicMap, sortCol, sortDir]);

  const typeBreakdown = useMemo<TypeBreakdown[]>(() => {
    const map = new Map<string, TypeBreakdown>();
    for (const s of stakeholders) {
      if (!map.has(s.type))
        map.set(s.type, { type: s.type, total: 0, responded: 0, pendingIds: [], uninvitedIds: [], rate: 0 });
      const e = map.get(s.type)!;
      e.total++;
      if (s.status === SurveyTokenStatus.COMPLETED) e.responded++;
      else if (s.status === SurveyTokenStatus.SENT || s.status === SurveyTokenStatus.OPENED)
        e.pendingIds.push(s.id);
      else if (s.status === SurveyTokenStatus.PENDING)
        e.uninvitedIds.push(s.id);
    }
    return Array.from(map.values()).map(e => ({
      ...e,
      rate: e.total > 0 ? Math.round((e.responded / e.total) * 100) : 0,
    }));
  }, [stakeholders]);

  const pillarStats = useMemo<Record<string, PillarStat>>(() => {
    const result: Record<string, PillarStat> = {};
    for (const pillar of ["E", "S", "G"]) {
      const codes  = selectedTopics.filter(c => c[0] === pillar);
      const scored = codes.filter(c => scores?.topicScores[c]);
      if (scored.length === 0) {
        result[pillar] = { impact: 0, financial: 0, combined: 0, count: 0, total: codes.length };
      } else {
        const sumI = scored.reduce((s, c) => s + scores!.topicScores[c].impactScore, 0);
        const sumF = scored.reduce((s, c) => s + scores!.topicScores[c].financialScore, 0);
        const avgI = sumI / scored.length;
        const avgF = sumF / scored.length;
        result[pillar] = {
          impact:   Math.round(avgI * 100) / 100,
          financial: Math.round(avgF * 100) / 100,
          combined: Math.round(((avgI + avgF) / 2) * 100) / 100,
          count: scored.length,
          total: codes.length,
        };
      }
    }
    return result;
  }, [scores, selectedTopics]);

  const chartData = useMemo(() => {
    if (!scores) return [];
    const codes =
      chartFilter === "ALL" ? selectedTopics : selectedTopics.filter(c => c[0] === chartFilter);
    return codes
      .filter(code => scores.topicScores[code])
      .map(code => ({
        code,
        Impact:    scores.topicScores[code].impactScore,
        Financial: scores.topicScores[code].financialScore,
      }));
  }, [scores, chartFilter, selectedTopics]);

  const totalUninvited = typeBreakdown.reduce((sum, row) => sum + row.uninvitedIds.length, 0);
  const topicsAssessed = scores ? Object.keys(scores.topicScores).length : 0;
  const criticalCount  = scores
    ? Object.values(scores.topicScores).filter(s => s.quadrant === "critical").length
    : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="p-8 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array<number>(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-44" />
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array<number>(3)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      </div>
    );
  }

  if (!assessment || assessment.status === AssessmentStatus.DRAFT) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 flex flex-col items-center text-center max-w-lg">
          <AlertCircle size={32} className="text-gray-300 mb-4" />
          <p className="text-base font-semibold text-gray-900 mb-2">Assessment not launched yet</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Launch the assessment to send survey links to stakeholders and begin collecting responses.
          </p>
          <Button asChild className="bg-[#ff6900] hover:bg-[#e05e00] text-white">
            <Link href={`/dashboard/assessment/${fyId}/launch`}>Go to Launch →</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5 pb-12">
      {toast && <Toast message={toast.msg} error={toast.error} />}

      {/* ── SECTION 1: HEADER STATS ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Response Rate */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Response Rate
          </p>
          <p className={cn("text-3xl font-bold mb-0.5", rateTextClass(pct))}>{pct}%</p>
          <p className="text-sm text-muted-foreground mb-3">
            {responseCount} of {totalCount} response{totalCount !== 1 ? "s" : ""}
          </p>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            {responseCount === 0 ? (
              <div className="h-2 w-full rounded-full bg-gray-200 animate-pulse" />
            ) : (
              <div
                className={cn("h-2 rounded-full transition-all", rateBarClass(pct))}
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
        </div>

        {/* Topics Assessed */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Topics Assessed
          </p>
          <p className="text-3xl font-bold text-gray-900 mb-0.5">{topicsAssessed}</p>
          <p className="text-sm text-muted-foreground">of {selectedTopics.length} selected</p>
        </div>

        {/* Critical Topics */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Critical Topics
          </p>
          <p
            className={cn("text-3xl font-bold mb-0.5", criticalCount > 0 ? "text-red-600" : "text-gray-900")}
          >
            {criticalCount}
          </p>
          <p className="text-sm text-muted-foreground">require attention</p>
        </div>

        {/* Last Updated + Recalculate */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Last Updated
          </p>
          <p className="text-sm font-semibold text-gray-900 mb-3 leading-snug min-h-[2.5rem]">
            {scores ? formatDateTime(scores.lastUpdated) : "—"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRecalculate()}
            disabled={recalculating}
            className="border-[#333a8b] text-[#333a8b] hover:bg-[#eff2ff] text-xs px-3 h-7"
          >
            <RefreshCw size={11} className={cn("mr-1.5", recalculating && "animate-spin")} />
            {recalculating ? "Recalculating…" : "Recalculate"}
          </Button>
        </div>
      </div>

      {/* Waiting for responses banner */}
      {totalUninvited > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              {totalUninvited} stakeholder{totalUninvited !== 1 ? "s" : ""} added after launch haven&apos;t received their survey invite yet.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => void handleSendInvites()}
            disabled={sendingInvites}
            className="shrink-0 bg-[#ff6900] hover:bg-[#e05e00] text-white"
          >
            {sendingInvites ? "Sending…" : `Send Invite${totalUninvited !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}

      {responseCount === 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <p className="text-sm font-medium text-blue-800">
            Waiting for stakeholders to submit their responses…
          </p>
        </div>
      )}

      {/* Scores need recalculation */}
      {responseCount > 0 && !scores && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              Responses have been submitted but scores haven&apos;t been calculated yet.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => void handleRecalculate()}
            disabled={recalculating}
            className="shrink-0 bg-[#333a8b] hover:bg-[#2a3070] text-white"
          >
            {recalculating ? "Recalculating…" : "Recalculate Scores"}
          </Button>
        </div>
      )}

      {/* ── SECTION 2: RESPONSE BREAKDOWN BY TYPE ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setBreakdownOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
        >
          Response Rate by Stakeholder Type
          {breakdownOpen
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {breakdownOpen && (
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Type", "Added", "Responded", "Rate", "Progress", ""].map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {typeBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No stakeholders found.
                    </td>
                  </tr>
                ) : typeBreakdown.map(row => (
                  <tr key={row.type} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{row.type}</td>
                    <td className="px-5 py-3 text-gray-600">{row.total}</td>
                    <td className="px-5 py-3 text-gray-600">{row.responded}</td>
                    <td className={cn("px-5 py-3 font-semibold", rateTextClass(row.rate))}>
                      {row.rate}%
                    </td>
                    <td className="px-5 py-3">
                      <div className="w-28 h-1.5 bg-gray-100 rounded-full">
                        <div
                          className={cn("h-1.5 rounded-full transition-all", rateBarClass(row.rate))}
                          style={{ width: `${row.rate}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.pendingIds.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!remindingType || sendingInvites}
                            onClick={() => void handleSendReminders(row.type, row.pendingIds)}
                            className="h-7 px-2.5 text-xs border-[#333a8b] text-[#333a8b] hover:bg-[#eff2ff]"
                          >
                            {remindingType === row.type ? "Sending…" : `Remind ${row.pendingIds.length}`}
                          </Button>
                        )}
                        {row.uninvitedIds.length > 0 && (
                          <span className="inline-flex items-center h-7 px-2.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            {row.uninvitedIds.length} not invited
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTIONS 3-5: Only shown once scores exist ────────────────────────── */}
      {scores && topicsAssessed > 0 && (
        <>
          {/* ── MATERIALITY MATRIX ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-gray-900">Materiality Matrix</h2>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs gap-1.5"
                onClick={downloadMatrix}
              >
                <Download size={11} />
                Download as PNG
              </Button>
            </div>
            <div className="p-6 flex justify-center overflow-x-auto">
              <MaterialityMatrix
                ref={matrixSvgRef}
                topicScores={scores.topicScores}
                topics={Array.from(topicMap.values())}
                impactThreshold={matrixThresholds.impact}
                financialThreshold={matrixThresholds.financial}
                onTopicClick={handleTopicClick}
                onThresholdChange={handleThresholdChange}
              />
            </div>
          </div>

          {/* ── SECTION 3: RANKED TOPICS TABLE ──────────────────────────────── */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-gray-900">
                Material Topics — Ranked by Combined Score
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs gap-1.5"
                onClick={() => setToast({ msg: "Export to Excel coming in Phase 6." })}
              >
                <Download size={11} />
                Export to Excel
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[160px]">Topic</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pillar</th>
                    {(["impact", "financial", "combined"] as SortCol[]).map(col => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800 whitespace-nowrap select-none"
                      >
                        {col === "impact" ? "Impact" : col === "financial" ? "Financial" : "Combined"}
                        {sortCol === col && <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>}
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quadrant</th>
                    <th
                      onClick={() => handleSort("respondents")}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800 whitespace-nowrap select-none"
                    >
                      Respondents
                      {sortCol === "respondents" && <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedTopics.map((entry, idx) => {
                    const isExpanded  = expandedTopic === entry.code;
                    const isHighlight = highlightedTopic === entry.code;
                    const dynQuadrant = computeQuadrant(
                      entry.score.impactScore,
                      entry.score.financialScore,
                      matrixThresholds.impact,
                      matrixThresholds.financial,
                    );
                    return (
                      <Fragment key={entry.code}>
                        <tr
                          id={`topic-row-${entry.code}`}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isHighlight ? "bg-yellow-50" : "hover:bg-gray-50/50",
                          )}
                          onClick={() => setExpandedTopic(isExpanded ? null : entry.code)}
                        >
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900">{entry.code}</p>
                            {entry.topic && (
                              <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                                {entry.topic.name}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3"><PillarBadge code={entry.pillarCode} /></td>
                          <td className="px-4 py-3"><ScoreBar score={entry.score.impactScore} /></td>
                          <td className="px-4 py-3"><ScoreBar score={entry.score.financialScore} /></td>
                          <td className="px-4 py-3"><ScoreBar score={entry.score.combinedScore} /></td>
                          <td className="px-4 py-3"><QuadrantBadge quadrant={dynQuadrant} /></td>
                          <td className="px-4 py-3 text-gray-700">{entry.score.respondentCount}</td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="px-6 py-4 bg-gray-50 border-b border-border">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Comments ({entry.score.comments.length})
                              </p>
                              {entry.score.comments.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No comments submitted for this topic.
                                </p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {entry.score.comments.map((comment, ci) => (
                                    <li
                                      key={ci}
                                      className="text-xs text-gray-700 bg-white border border-border rounded-lg px-3 py-2"
                                    >
                                      &ldquo;{comment}&rdquo;
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION 4: BAR CHART ────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-900">Scores by Topic</h2>
              <div className="flex gap-1.5">
                {(["ALL", "E", "S", "G"] as PillarFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setChartFilter(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                      chartFilter === f
                        ? "bg-[#333a8b] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {f === "ALL" ? "All" : PILLAR[f].label}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No scored topics in this pillar.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white border border-border rounded-lg shadow-md p-3">
                          <p className="text-xs font-semibold text-gray-900 mb-2">{label}</p>
                          {payload.map((entry, i) => (
                            <p key={i} className="text-xs" style={{ color: entry.color }}>
                              {entry.name}:{" "}
                              {typeof entry.value === "number"
                                ? entry.value.toFixed(2)
                                : String(entry.value ?? "")}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                  <Bar dataKey="Impact"    fill="#333a8b" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="Financial" fill="#ff6900" radius={[3, 3, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── SECTION 5: PILLAR SUMMARY ───────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["E", "S", "G"] as const).map(pillar => {
              const p    = PILLAR[pillar];
              const stat = pillarStats[pillar] ?? { impact: 0, financial: 0, combined: 0, count: 0, total: 0 };
              return (
                <div
                  key={pillar}
                  className="bg-white rounded-xl border border-border shadow-sm overflow-hidden"
                  style={{ borderTop: `4px solid ${p.borderColor}` }}
                >
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: p.bg, color: p.color }}
                      >
                        {pillar}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900">{p.label}</h3>
                    </div>

                    {stat.count === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No topics scored yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {(
                          [
                            { label: "Avg Impact",    value: stat.impact },
                            { label: "Avg Financial", value: stat.financial },
                            { label: "Avg Combined",  value: stat.combined, bold: true },
                          ] as { label: string; value: number; bold?: boolean }[]
                        ).map(({ label, value, bold }) => (
                          <div key={label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{label}</span>
                              <span className={cn("text-gray-900", bold ? "font-bold" : "font-semibold")}>
                                {value.toFixed(2)}{bold ? " / 5" : ""}
                              </span>
                            </div>
                            <div className={cn("rounded-full bg-gray-100", bold ? "h-2" : "h-1.5")}>
                              <div
                                className={cn("rounded-full", bold ? "h-2" : "h-1.5")}
                                style={{
                                  width: `${(value / 5) * 100}%`,
                                  backgroundColor: bold ? p.borderColor : scoreBarColor(value),
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="mt-4 text-xs text-muted-foreground">
                      {stat.count} of {stat.total} topic{stat.total !== 1 ? "s" : ""} rated
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── DOWNLOAD REPORTS ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-900">Download Reports</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Reports include all responses received to date.
          {responseCount === 0 && " Add responses before generating reports."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={responseCount === 0 || generatingPdf}
            onClick={() => void handleDownloadPdf()}
            className="bg-[#333a8b] hover:bg-[#2a3070] text-white rounded-lg px-5 h-10 text-sm font-semibold"
          >
            {generatingPdf ? "Generating PDF…" : "Download PDF Report"}
          </Button>
          <Button
            disabled={responseCount === 0 || generatingExcel}
            onClick={() => void handleDownloadExcel()}
            className="bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg px-5 h-10 text-sm font-semibold"
          >
            {generatingExcel ? "Generating Excel…" : "Download Excel Data"}
          </Button>
        </div>
      </div>
    </div>
  );
}
