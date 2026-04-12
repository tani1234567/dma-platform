"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { InvalidTokenPage } from "./components/InvalidTokenPage";
import { AlreadySubmittedPage } from "./components/AlreadySubmittedPage";
import { ExpiredTokenPage } from "./components/ExpiredTokenPage";
import { ThankYouPage } from "./components/ThankYouPage";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "loading"
  | "invalid"
  | "already_submitted"
  | "expired"
  | "welcome"
  | "survey"
  | "review"
  | "done";

interface RatingEntry {
  impact: number;    // 0 = unset, 1–5 = selected
  financial: number; // 0 = unset, 1–5 = selected
  comment?: string;
}

interface GRITopicLocal {
  id: string;
  code: string;
  name: string;
  pillar: string;
  pillarCode: string;
  description: string;
  griReference: string;
}

interface SurveyPayload {
  stakeholderId: string;
  stakeholderName: string;
  stakeholderType: string;
  companyId: string;
  fyId: string;
  company: { companyName: string; logoUrl: string | null };
  assessment: { fyYear: string; selectedTopics: string[] };
  topics: GRITopicLocal[];
}

interface ApiError {
  error: string;
  message?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCORE_LABELS = ["Very Low", "Low", "Medium", "High", "Very High"] as const;

const PILLAR_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  E: { bg: "#dcfce7", text: "#166534", label: "Environmental" },
  S: { bg: "#dbeafe", text: "#1e40af", label: "Social" },
  G: { bg: "#ffedd5", text: "#9a3412", label: "Governance" },
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function Toast({ message, error }: { message: string; error?: boolean }) {
  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium pointer-events-none whitespace-nowrap",
        error ? "bg-red-600" : "bg-gray-900"
      )}
    >
      {message}
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1.5 cursor-help">
      <Info size={14} className="text-gray-400" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 rounded-lg bg-gray-800 text-white text-xs p-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed shadow-lg">
        {text}
      </span>
    </span>
  );
}

function CompanyAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <div className="w-16 h-16 rounded-full bg-[#333a8b] flex items-center justify-center text-white text-xl font-bold">
      {initials}
    </div>
  );
}

function ScoreSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border py-3 px-2 transition-all cursor-pointer select-none",
            value === n
              ? "border-2 border-[#333a8b] bg-[#eff2ff]"
              : "border border-gray-200 hover:border-gray-300 bg-white"
          )}
        >
          <span
            className={cn(
              "text-2xl font-bold leading-none",
              value === n ? "text-[#333a8b]" : "text-gray-900"
            )}
          >
            {n}
          </span>
          <span className="text-[11px] text-gray-500 mt-1.5 leading-tight text-center">
            {SCORE_LABELS[n - 1]}
          </span>
        </button>
      ))}
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const cls =
    score <= 0
      ? "bg-gray-100 text-gray-400"
      : score <= 2
      ? "bg-gray-100 text-gray-700"
      : score === 3
      ? "bg-yellow-100 text-yellow-800"
      : "bg-[#eff2ff] text-[#333a8b]";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold",
        cls
      )}
    >
      {score > 0 ? score : "—"}
    </span>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen({
  payload,
  onStart,
}: {
  payload: SurveyPayload;
  onStart: () => void;
}) {
  const { company, assessment, topics } = payload;
  const estimated = Math.ceil(topics.length * 1.5);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow border border-gray-100 max-w-lg w-full p-8 sm:p-10 text-center">
        {/* Logo / avatar */}
        <div className="flex justify-center mb-6">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.companyName}
              className="max-h-16 object-contain"
            />
          ) : (
            <CompanyAvatar name={company.companyName} />
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {company.companyName} ESG Materiality Survey
        </h1>
        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          You have been invited to participate in{" "}
          <span className="font-semibold">{company.companyName}</span>&apos;s ESG Double
          Materiality Assessment for FY {assessment.fyYear}.
        </p>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left mb-6">
          <p className="text-sm text-blue-900 leading-relaxed">
            This survey has <strong>{topics.length} topics</strong>. For each topic you will
            provide two ratings:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-blue-900">
            <li>
              <strong>• Impact Score:</strong> How significantly does this topic impact the
              environment or society?
            </li>
            <li>
              <strong>• Financial Score:</strong> How significantly does this topic affect the
              company&apos;s finances?
            </li>
          </ul>
          <p className="mt-2 text-sm text-blue-900">
            Both scores use a 1–5 scale: 1 = Very Low, 2 = Low, 3 = Medium, 4 = High,
            5 = Very High
          </p>
        </div>

        <p className="text-sm text-gray-500 mb-8">⏱ Estimated time: {estimated} minutes</p>

        <button
          onClick={onStart}
          className="bg-[#ff6900] hover:bg-[#e05e00] text-white rounded-xl px-8 py-3 text-base font-semibold transition-colors w-full sm:w-auto"
        >
          Start Survey →
        </button>
      </div>
    </div>
  );
}

// ─── Topic card (one topic per screen) ───────────────────────────────────────

function TopicCard({
  topic,
  rating,
  onChange,
  onPrev,
  onNext,
  isFirst,
  isLast,
  currentIdx,
  total,
  pct,
  companyName,
}: {
  topic: GRITopicLocal;
  rating: RatingEntry;
  onChange: (r: RatingEntry) => void;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
  currentIdx: number;
  total: number;
  pct: number;
  companyName: string;
}) {
  const [showError, setShowError] = useState(false);
  const [comment, setComment] = useState(rating.comment ?? "");

  const pillar = PILLAR_STYLE[topic.pillarCode] ?? PILLAR_STYLE["E"];

  function handleCommentChange(val: string) {
    const trimmed = val.slice(0, 500);
    setComment(trimmed);
    onChange({ ...rating, comment: trimmed });
  }

  function handleNext() {
    if (!rating.impact || !rating.financial) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onNext();
  }

  // Clear error once both scores selected
  useEffect(() => {
    if (rating.impact && rating.financial) setShowError(false);
  }, [rating.impact, rating.financial]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed progress bar + header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-[#333a8b] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="px-4 py-2 text-center text-xs text-gray-500 font-medium tracking-wide">
          {companyName} | Topic {currentIdx + 1} of {total}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="pt-16 px-4 pb-10 flex justify-center">
        <div className="w-full max-w-2xl mt-6">
          <div className="bg-white rounded-xl shadow border border-gray-100 p-6 sm:p-8">
            {/* Pillar badge + code + GRI ref */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className="px-2.5 py-0.5 rounded text-xs font-semibold"
                style={{ backgroundColor: pillar.bg, color: pillar.text }}
              >
                {pillar.label}
              </span>
              <span className="text-xs font-mono font-semibold text-gray-600">{topic.code}</span>
              <span className="text-xs text-gray-400">{topic.griReference}</span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">{topic.name}</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">{topic.description}</p>

            <div className="border-t border-gray-100 mb-6" />

            {/* Impact score */}
            <div className="mb-6">
              <div className="flex items-center mb-3">
                <span className="text-sm font-semibold text-gray-900">
                  Impact Materiality Score
                </span>
                <Tooltip text="How significantly does this company's activity on this topic impact the environment or society?" />
              </div>
              <ScoreSelector
                value={rating.impact}
                onChange={(v) => onChange({ ...rating, impact: v })}
              />
            </div>

            {/* Financial score */}
            <div className="mb-6">
              <div className="flex items-center mb-3">
                <span className="text-sm font-semibold text-gray-900">
                  Financial Materiality Score
                </span>
                <Tooltip text="How significantly does this topic create financial risk or opportunity for the company?" />
              </div>
              <ScoreSelector
                value={rating.financial}
                onChange={(v) => onChange({ ...rating, financial: v })}
              />
            </div>

            {/* Comment */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-900">
                  Comments{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <span className="text-xs text-gray-400">{comment.length}/500</span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => handleCommentChange(e.target.value)}
                rows={3}
                placeholder="Share any specific concerns or observations about this topic..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#333a8b]/20 focus:border-[#333a8b] placeholder:text-gray-400 transition-colors"
              />
            </div>

            {/* Validation error */}
            {showError && (
              <p className="text-red-500 text-sm mb-4">
                Please rate both Impact and Financial scores to continue.
              </p>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onPrev}
                disabled={isFirst}
                className={cn(
                  "px-5 py-2.5 rounded-xl border text-sm font-semibold transition-colors",
                  isFirst
                    ? "border-gray-100 text-gray-300 cursor-not-allowed"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl bg-[#333a8b] hover:bg-[#2a3070] text-white text-sm font-semibold transition-colors"
              >
                {isLast ? "Review & Submit →" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Review screen ────────────────────────────────────────────────────────────

function ReviewScreen({
  payload,
  topics,
  ratings,
  onEdit,
  onSubmit,
  submitting,
}: {
  payload: SurveyPayload;
  topics: GRITopicLocal[];
  ratings: Record<string, RatingEntry>;
  onEdit: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Your Responses</h1>
        <p className="text-sm text-gray-500 mb-6">
          {payload.company.companyName} — FY {payload.assessment.fyYear}
        </p>

        {/* Summary table */}
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Topic</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-700">Impact</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-700">Financial</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-700">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topics.map((topic) => {
                  const r = ratings[topic.code];
                  return (
                    <tr key={topic.code} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{topic.name}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{topic.code}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ScorePill score={r?.impact ?? 0} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ScorePill score={r?.financial ?? 0} />
                      </td>
                      <td className="px-3 py-3 text-center text-sm">
                        {r?.comment ? (
                          <span className="text-green-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <button
            type="button"
            onClick={onEdit}
            disabled={submitting}
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            ← Edit Responses
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="bg-[#ff6900] hover:bg-[#e05e00] disabled:opacity-70 text-white rounded-xl px-8 py-3 text-base font-semibold transition-colors w-full sm:max-w-xs"
          >
            {submitting ? "Submitting…" : "Submit Survey"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Core survey logic ────────────────────────────────────────────────────────

function SurveyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [payload, setPayload] = useState<SurveyPayload | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [ratings, setRatings] = useState<Record<string, RatingEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  // ── Token validation ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setPhase("invalid");
      return;
    }

    fetch(`/api/survey/validate?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as SurveyPayload;
          // Sort topics to match selectedTopics order
          const order = data.assessment.selectedTopics;
          data.topics.sort(
            (a, b) => order.indexOf(a.code) - order.indexOf(b.code)
          );
          setPayload(data);
          setPhase("welcome");
        } else {
          const body = (await res.json()) as ApiError;
          if (res.status === 409 || body.error === "already_submitted") {
            setPhase("already_submitted");
          } else if (res.status === 410 || body.error === "expired") {
            setPhase("expired");
          } else {
            setPhase("invalid");
          }
        }
      })
      .catch(() => setPhase("invalid"));
  }, [token]);

  // ── Restore from localStorage after payload is ready ──────────────────────

  useEffect(() => {
    if (!payload || !token) return;
    try {
      const saved = localStorage.getItem(`survey_${token}`);
      if (saved) {
        setRatings(JSON.parse(saved) as Record<string, RatingEntry>);
      }
    } catch {
      /* ignore parse errors */
    }
  }, [payload, token]);

  // ── Auto-save on every rating change ──────────────────────────────────────

  useEffect(() => {
    if (!token || Object.keys(ratings).length === 0) return;
    try {
      localStorage.setItem(`survey_${token}`, JSON.stringify(ratings));
    } catch {
      /* ignore quota errors */
    }
  }, [ratings, token]);

  // ── Toast auto-dismiss ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const topics = payload?.topics ?? [];
  const currentTopic = topics[currentIdx];
  const currentRating: RatingEntry = ratings[currentTopic?.code ?? ""] ?? {
    impact: 0,
    financial: 0,
  };
  const pct = topics.length > 0 ? ((currentIdx + 1) / topics.length) * 100 : 0;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function updateRating(code: string, r: RatingEntry) {
    setRatings((prev) => ({ ...prev, [code]: r }));
  }

  function handleNext() {
    if (currentIdx < topics.length - 1) {
      setCurrentIdx((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setPhase("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePrev() {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleEditFromReview() {
    setPhase("survey");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!payload) return;

    // Guard: ensure all topics are rated (defensive; per-topic nav already enforces this)
    const allRated = topics.every(
      (t) => (ratings[t.code]?.impact ?? 0) >= 1 && (ratings[t.code]?.financial ?? 0) >= 1
    );
    if (!allRated) {
      setToast({ msg: "Please rate all topics before submitting.", error: true });
      setPhase("survey");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/survey/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ratings }),
      });

      if (res.ok) {
        try {
          localStorage.removeItem(`survey_${token}`);
        } catch {
          /* ignore */
        }
        setPhase("done");
      } else {
        const body = (await res.json()) as ApiError;
        setToast({
          msg: body.message ?? "Submission failed. Please try again.",
          error: true,
        });
      }
    } catch {
      setToast({ msg: "Network error. Please check your connection.", error: true });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render phases ──────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#333a8b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading your survey…</p>
        </div>
      </div>
    );
  }

  if (phase === "invalid") return <InvalidTokenPage />;
  if (phase === "already_submitted") return <AlreadySubmittedPage />;
  if (phase === "expired") return <ExpiredTokenPage />;
  if (phase === "done") {
    return (
      <ThankYouPage
        companyName={payload?.company.companyName ?? ""}
        fyYear={payload?.assessment.fyYear ?? ""}
      />
    );
  }

  if (!payload) return null;

  if (phase === "welcome") {
    return <WelcomeScreen payload={payload} onStart={() => setPhase("survey")} />;
  }

  if (phase === "review") {
    return (
      <>
        {toast && <Toast message={toast.msg} error={toast.error} />}
        <ReviewScreen
          payload={payload}
          topics={topics}
          ratings={ratings}
          onEdit={handleEditFromReview}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </>
    );
  }

  // survey phase — guard against missing topic
  if (!currentTopic) return null;

  return (
    <>
      {toast && <Toast message={toast.msg} error={toast.error} />}
      <TopicCard
        key={currentTopic.code}
        topic={currentTopic}
        rating={currentRating}
        onChange={(r) => updateRating(currentTopic.code, r)}
        onPrev={handlePrev}
        onNext={handleNext}
        isFirst={currentIdx === 0}
        isLast={currentIdx === topics.length - 1}
        currentIdx={currentIdx}
        total={topics.length}
        pct={pct}
        companyName={payload.company.companyName}
      />
    </>
  );
}

// ─── Default export — Suspense boundary required for useSearchParams ──────────

export default function SurveyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-[#333a8b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading your survey…</p>
          </div>
        </div>
      }
    >
      <SurveyContent />
    </Suspense>
  );
}
