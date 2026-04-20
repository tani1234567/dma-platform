"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Send,
  User,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/PageShell";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SurveyQuestion { id: string; text: string; }

interface TopicData {
  code: string;
  name: string;
  pillar: string;
  pillarCode: string;
  description: string;
  griReference: string;
  questions: SurveyQuestion[];
}

interface StakeholderData {
  id: string; name: string; email: string; type: string;
  weight: number; organisation: string; topicCount: number;
}

interface AssessmentData { id: string; financialYear: string; }

interface SurveyPayload {
  stakeholder: StakeholderData;
  assessment: AssessmentData;
  topics: TopicData[];
}

// Per-question rating (what we collect in the form)
interface QuestionRating { impact: number; financial: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const PILLAR_STYLES: Record<string, { badge: string; bg: string; text: string; border: string }> = {
  E: { badge: "bg-green-100 text-green-700",  bg: "bg-green-50/60",  text: "text-green-700",  border: "border-green-200" },
  S: { badge: "bg-blue-100 text-blue-700",    bg: "bg-blue-50/60",   text: "text-blue-700",   border: "border-blue-200"  },
  G: { badge: "bg-purple-100 text-purple-700", bg: "bg-purple-50/60", text: "text-purple-700", border: "border-purple-200"},
};

const TYPE_COLORS: Record<string, string> = {
  Management: "bg-purple-100 text-purple-700", Employees: "bg-blue-100 text-blue-700",
  Customers: "bg-green-100 text-green-700",    Suppliers: "bg-amber-100 text-amber-700",
  Community: "bg-pink-100 text-pink-700",      Investors: "bg-indigo-100 text-indigo-700",
  "Experts/NGOs": "bg-teal-100 text-teal-700",
};

const SCORE_LABELS = ["", "Very Low", "Low", "Medium", "High", "Very High"] as const;

// ─── ScoreSelector ────────────────────────────────────────────────────────────

function ScoreSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {([1, 2, 3, 4, 5] as const).map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          title={SCORE_LABELS[n]}
          className={`flex-1 flex flex-col items-center justify-center rounded-lg border py-2 px-1 transition-all select-none ${
            value === n
              ? "border-2 border-[#333a8b] bg-[#eff2ff]"
              : "border border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <span className={`text-base font-bold leading-none ${value === n ? "text-[#333a8b]" : "text-gray-700"}`}>
            {n}
          </span>
          <span className="text-[9px] text-gray-400 mt-1 leading-tight text-center hidden sm:block">
            {SCORE_LABELS[n]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── QuestionRow ──────────────────────────────────────────────────────────────

function QuestionRow({
  question,
  index,
  rating,
  onChange,
}: {
  question: SurveyQuestion;
  index: number;
  rating: QuestionRating;
  onChange: (r: QuestionRating) => void;
}) {
  const isRated = rating.impact > 0 && rating.financial > 0;

  return (
    <div className={`rounded-lg border p-4 transition-all ${isRated ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-white"}`}>
      {/* Question text */}
      <div className="flex items-start gap-2.5 mb-4">
        <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 text-[11px] font-bold text-gray-500 flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <p className="text-sm text-gray-800 leading-relaxed flex-1">{question.text}</p>
        {isRated && <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />}
      </div>

      {/* Rating controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7">
        <div>
          <div className="flex items-center gap-1 mb-2">
            <p className="text-xs font-semibold text-gray-600">Impact Materiality</p>
            <span title="How significantly does this company's activity on this topic impact the environment or society?">
              <Info size={11} className="text-gray-400 cursor-help" />
            </span>
          </div>
          <ScoreSelector value={rating.impact} onChange={v => onChange({ ...rating, impact: v })} />
        </div>
        <div>
          <div className="flex items-center gap-1 mb-2">
            <p className="text-xs font-semibold text-gray-600">Financial Materiality</p>
            <span title="How significantly does this topic create financial risk or opportunity for the company?">
              <Info size={11} className="text-gray-400 cursor-help" />
            </span>
          </div>
          <ScoreSelector value={rating.financial} onChange={v => onChange({ ...rating, financial: v })} />
        </div>
      </div>
    </div>
  );
}

// ─── TopicSection ─────────────────────────────────────────────────────────────

function TopicSection({
  topic,
  ratings,
  comment,
  onRatingChange,
  onCommentChange,
}: {
  topic: TopicData;
  ratings: Record<string, QuestionRating>;
  comment: string;
  onRatingChange: (qId: string, r: QuestionRating) => void;
  onCommentChange: (comment: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const styles = PILLAR_STYLES[topic.pillarCode] ?? PILLAR_STYLES["E"];

  const ratedCount   = topic.questions.filter(q => (ratings[q.id]?.impact ?? 0) > 0 && (ratings[q.id]?.financial ?? 0) > 0).length;
  const allRated     = ratedCount === topic.questions.length && topic.questions.length > 0;

  return (
    <div className={`rounded-xl border-2 transition-all ${allRated ? "border-green-300" : "border-gray-200"}`}>
      {/* Topic header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between p-4 text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className={`shrink-0 mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${styles.badge}`}>
            {topic.code}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 text-sm">{topic.name}</p>
              {allRated && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {topic.griReference && <span>{topic.griReference} · </span>}
              {ratedCount}/{topic.questions.length} questions rated
            </p>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={15} className="text-gray-400 shrink-0 mt-1 ml-4" />
          : <ChevronDown size={15} className="text-gray-400 shrink-0 mt-1 ml-4" />
        }
      </button>

      {expanded && (
        <div className={`px-4 pb-4 border-t pt-4 ${styles.border}`}>
          {/* Topic description */}
          {topic.description && (
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">{topic.description}</p>
          )}

          {/* Scale legend */}
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 ${styles.bg}`}>
            <Info size={11} className={styles.text} />
            <span className={styles.text}>
              Rate each question 1–5: &nbsp;1 = Very Low &nbsp;·&nbsp; 3 = Medium &nbsp;·&nbsp; 5 = Very High
            </span>
          </div>

          {/* Question rows */}
          <div className="space-y-3">
            {topic.questions.map((q, i) => (
              <QuestionRow
                key={q.id}
                question={q}
                index={i}
                rating={ratings[q.id] ?? { impact: 0, financial: 0 }}
                onChange={r => onRatingChange(q.id, r)}
              />
            ))}
          </div>

          {/* Per-topic comment */}
          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              Comment for this topic{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={e => onCommentChange(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Any specific observations or context for this topic…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#333a8b] resize-none transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function SurveyFormInner() {
  const params       = useParams<{ stakeholderId: string }>();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const stakeholderId = params.stakeholderId;
  const assessmentId  = searchParams.get("assessmentId") ?? "";

  const [payload, setPayload]   = useState<SurveyPayload | null>(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Per-question ratings: { "E1_Q1": { impact: 0, financial: 0 }, … }
  const [ratings, setRatings]   = useState<Record<string, QuestionRating>>({});
  // Per-topic comments: { "E1": "comment text", … }
  const [comments, setComments] = useState<Record<string, string>>({});

  const hasFetched = useRef(false);

  useEffect(() => {
    if (!stakeholderId || !assessmentId || hasFetched.current) return;
    hasFetched.current = true;

    void fetch(`/api/agent/survey?stakeholderId=${stakeholderId}&assessmentId=${assessmentId}`)
      .then(async r => {
        if (r.status === 401) { router.replace("/login"); return; }
        if (r.status === 409) { setError("This survey has already been submitted."); return; }
        if (r.status === 404) { setError("Stakeholder or assessment not found."); return; }
        const d = await r.json() as SurveyPayload | { error: string };
        if ("error" in d) { setError(d.error); return; }
        setPayload(d);
        // Initialise all question ratings to 0
        const init: Record<string, QuestionRating> = {};
        for (const topic of d.topics) {
          for (const q of topic.questions) {
            init[q.id] = { impact: 0, financial: 0 };
          }
        }
        setRatings(init);
      })
      .catch(() => setError("Failed to load survey."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakeholderId, assessmentId]);

  // ── Derived counts ───────────────────────────────────────────────────────────

  const totalQuestions = payload?.topics.reduce((s, t) => s + t.questions.length, 0) ?? 0;
  const ratedQuestions = Object.values(ratings).filter(r => r.impact > 0 && r.financial > 0).length;
  const allRated       = totalQuestions > 0 && ratedQuestions === totalQuestions;
  const progress       = totalQuestions > 0 ? Math.round((ratedQuestions / totalQuestions) * 100) : 0;

  function handleRatingChange(qId: string, r: QuestionRating) {
    setRatings(prev => ({ ...prev, [qId]: r }));
    setError(null);
  }

  function handleCommentChange(topicCode: string, text: string) {
    setComments(prev => ({ ...prev, [topicCode]: text }));
  }

  async function handleSubmit() {
    if (!allRated) {
      setError("Please rate all questions (Impact and Financial) before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stakeholderId, assessmentId, ratings, comments }),
      });
      const d = await res.json() as { success: boolean } | { error: string; message?: string };
      if (!res.ok || "error" in d) {
        setError("message" in d && d.message ? d.message : ("error" in d ? d.error : "Submission failed."));
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success ──────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <PageShell title="">
        <div className="max-w-md mx-auto mt-20 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Survey Submitted</h2>
          <p className="text-sm text-muted-foreground mb-1.5">
            Proxy submission for{" "}
            <span className="font-semibold text-gray-800">{payload?.stakeholder.name}</span>.
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            {ratedQuestions} question{ratedQuestions !== 1 ? "s" : ""} across{" "}
            {payload?.topics.length} topic{payload?.topics.length !== 1 ? "s" : ""} rated.
            Scores will update shortly.
          </p>
          <Button
            onClick={() => router.push(`/agent/assignments?assessmentId=${assessmentId}`)}
            className="bg-[#333a8b] hover:bg-[#2a3070] text-white"
          >
            <ArrowLeft size={13} className="mr-1.5" />
            Back to Assignments
          </Button>
        </div>
      </PageShell>
    );
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell title="">
        <div className="flex items-center justify-between mb-6">
          <div className="h-4 w-48 rounded bg-gray-200 animate-pulse" />
          <div className="h-8 w-28 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="h-20 rounded-2xl bg-gray-100 animate-pulse mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </PageShell>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────────────

  if (!payload) {
    return (
      <PageShell title="">
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <AlertCircle size={36} className="text-gray-300" />
          <p className="text-sm text-gray-500">{error ?? "Survey data not found."}</p>
          <Button variant="outline" size="sm"
            onClick={() => router.push(`/agent/assignments?assessmentId=${assessmentId}`)}>
            <ArrowLeft size={13} className="mr-1.5" /> Back to Assignments
          </Button>
        </div>
      </PageShell>
    );
  }

  const { stakeholder, assessment, topics } = payload;

  // ── Main form ────────────────────────────────────────────────────────────────

  return (
    <PageShell title="">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button
            onClick={() => router.push(`/agent/assignments?assessmentId=${assessmentId}`)}
            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={13} /> Assignments
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-medium truncate max-w-[200px]">
            {stakeholder.name}
          </span>
        </nav>
        <Button
          onClick={() => void handleSubmit()}
          disabled={submitting || !allRated}
          className="bg-[#333a8b] hover:bg-[#2a3070] text-white disabled:opacity-40 shrink-0"
          size="sm"
        >
          <Send size={13} className="mr-1.5" />
          {submitting ? "Submitting…" : "Submit Survey"}
        </Button>
      </div>

      {/* Stakeholder card */}
      <div className="rounded-2xl border bg-gradient-to-br from-[#eff2ff] to-white p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#333a8b]/10 flex items-center justify-center shrink-0">
              <User size={18} className="text-[#333a8b]" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{stakeholder.name}</p>
              <p className="text-xs text-muted-foreground">{stakeholder.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[stakeholder.type] ?? "bg-gray-100 text-gray-600"}`}>
                  {stakeholder.type}
                </span>
                {stakeholder.organisation && (
                  <span className="text-xs text-muted-foreground">{stakeholder.organisation}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  Weight: {(stakeholder.weight * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">FY {assessment.financialYear}</p>
            <p className="text-xl font-bold text-gray-900">{totalQuestions}</p>
            <p className="text-xs text-muted-foreground">questions</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-gray-700">
            {ratedQuestions} of {totalQuestions} questions rated
          </p>
          <p className="text-xs font-bold text-[#333a8b]">{progress}%</p>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#333a8b] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-5 text-sm text-red-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Topic sections */}
      <div className="space-y-4">
        {topics.map(topic => (
          <TopicSection
            key={topic.code}
            topic={topic}
            ratings={ratings}
            comment={comments[topic.code] ?? ""}
            onRatingChange={handleRatingChange}
            onCommentChange={text => handleCommentChange(topic.code, text)}
          />
        ))}
      </div>

      {/* Sticky submit bar */}
      <div className="sticky bottom-0 mt-6 -mx-6 px-6 py-4 bg-white/90 backdrop-blur-sm border-t border-gray-200 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-700">
            {allRated
              ? "All questions rated — ready to submit"
              : `${totalQuestions - ratedQuestions} question${totalQuestions - ratedQuestions !== 1 ? "s" : ""} remaining`}
          </p>
          <p className="text-xs text-muted-foreground">
            Proxy submission for <span className="font-medium">{stakeholder.name}</span>
          </p>
        </div>
        <Button
          onClick={() => void handleSubmit()}
          disabled={submitting || !allRated}
          className="bg-[#333a8b] hover:bg-[#2a3070] text-white disabled:opacity-40 shrink-0"
        >
          <Send size={13} className="mr-1.5" />
          {submitting ? "Submitting…" : "Submit Survey"}
        </Button>
      </div>
    </PageShell>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SurveyFormPage() {
  return (
    <Suspense>
      <SurveyFormInner />
    </Suspense>
  );
}
