"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  AlertCircle,
  CheckCircle2,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/layout/PageShell";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SurveyQuestion {
  id: string;
  text: string;
}

interface TopicDetail {
  id: string;
  code: string;
  name: string;
  pillar: string;
  pillarCode: "E" | "S" | "G";
  griReference: string;
  description: string;
  questions: SurveyQuestion[];
  isActive: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PILLAR_STYLES: Record<string, { badge: string; bg: string; text: string; dot: string }> = {
  E: {
    badge: "bg-green-100 text-green-700 border-green-200",
    bg:    "bg-green-50",
    text:  "text-green-700",
    dot:   "bg-green-500",
  },
  S: {
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    bg:    "bg-blue-50",
    text:  "text-blue-700",
    dot:   "bg-blue-500",
  },
  G: {
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    bg:    "bg-purple-50",
    text:  "text-purple-700",
    dot:   "bg-purple-500",
  },
};

const PILLAR_LABELS: Record<string, string> = {
  E: "Environmental",
  S: "Social",
  G: "Governance",
};

const MAX_QUESTION_LENGTH = 500;

// ─── QuestionRow component ────────────────────────────────────────────────────

interface QuestionRowProps {
  question: SurveyQuestion;
  index: number;
  total: number;
  pillarCode: string;
  onChange: (index: number, text: string) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  autoFocus?: boolean;
}

function QuestionRow({
  question,
  index,
  total,
  pillarCode,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  autoFocus,
}: QuestionRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const styles = PILLAR_STYLES[pillarCode] ?? PILLAR_STYLES["E"];

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [question.text]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  function handleDelete() {
    if (question.text.trim().length === 0 || confirmDelete) {
      onDelete(index);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  const charCount = question.text.length;
  const isNearLimit = charCount > MAX_QUESTION_LENGTH * 0.85;

  return (
    <div className={`group relative rounded-xl border transition-all duration-150 ${
      confirmDelete
        ? "border-red-300 bg-red-50/60"
        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
    }`}>
      <div className="flex items-start gap-3 p-4">
        {/* Grip + number */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0 select-none">
          <GripVertical size={16} className="text-gray-300 group-hover:text-gray-400 cursor-grab" />
          <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${styles.badge} border`}>
            {index + 1}
          </span>
        </div>

        {/* Textarea */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={question.text}
            onChange={e => onChange(index, e.target.value)}
            maxLength={MAX_QUESTION_LENGTH}
            rows={1}
            placeholder={`Enter question ${index + 1}…`}
            className="w-full resize-none overflow-hidden bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none leading-relaxed"
          />
          {isNearLimit && (
            <p className={`text-xs mt-1 ${charCount >= MAX_QUESTION_LENGTH ? "text-red-500" : "text-amber-500"}`}>
              {charCount}/{MAX_QUESTION_LENGTH} characters
            </p>
          )}
          {confirmDelete && (
            <p className="text-xs text-red-600 mt-1 font-medium">
              Click delete again to confirm removal
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            title="Move up"
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1}
            title="Move down"
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={handleDelete}
            title={confirmDelete ? "Click to confirm delete" : "Delete question"}
            className={`p-1 rounded-md transition-colors ${
              confirmDelete
                ? "text-red-600 bg-red-100 hover:bg-red-200"
                : "text-gray-400 hover:text-red-600 hover:bg-red-50"
            }`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TopicQuestionsPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const router = useRouter();

  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [newRowIndex, setNewRowIndex] = useState<number | null>(null);
  const hasFetched = useRef(false);

  // Track unsaved changes
  const savedQuestionsRef = useRef<SurveyQuestion[]>([]);
  const isDirty = JSON.stringify(questions) !== JSON.stringify(savedQuestionsRef.current);

  // Warn on page unload if dirty
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Fetch topic
  useEffect(() => {
    if (!code || hasFetched.current) return;
    hasFetched.current = true;

    void fetch(`/api/admin/topics/${code}`)
      .then(async r => {
        if (r.status === 401) { router.replace("/login"); return; }
        if (r.status === 404) { setError("Topic not found."); return; }
        const d = await r.json() as { topic: TopicDetail } | { error: string };
        if ("error" in d) { setError("Failed to load topic."); return; }
        setTopic(d.topic);
        setQuestions(d.topic.questions ?? []);
        savedQuestionsRef.current = d.topic.questions ?? [];
      })
      .catch(() => setError("Failed to load topic."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Question mutation helpers
  const handleChange = useCallback((index: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, text } : q));
    setSaveStatus("idle");
  }, []);

  const handleDelete = useCallback((index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
    setSaveStatus("idle");
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setQuestions(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setSaveStatus("idle");
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setQuestions(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setSaveStatus("idle");
  }, []);

  function handleAddQuestion() {
    const newQ: SurveyQuestion = { id: `${code}_Q${questions.length + 1}`, text: "" };
    setQuestions(prev => [...prev, newQ]);
    setNewRowIndex(questions.length);
    setSaveStatus("idle");
  }

  function handleDiscard() {
    setQuestions(savedQuestionsRef.current);
    setSaveStatus("idle");
    setNewRowIndex(null);
  }

  async function handleSave() {
    if (!isDirty) return;

    // Validate: no empty questions
    const hasEmpty = questions.some(q => q.text.trim().length === 0);
    if (hasEmpty) {
      setError("All questions must have text. Remove or fill in empty questions before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveStatus("idle");

    try {
      const r = await fetch(`/api/admin/topics/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      const d = await r.json() as { success: boolean } | { error: string };
      if (!r.ok || "error" in d) {
        setError("Failed to save questions. Please try again.");
        setSaveStatus("error");
        return;
      }
      // Re-index IDs to match what server returned
      const saved = questions.map((q, i) => ({ ...q, id: `${code}_Q${i + 1}` }));
      setQuestions(saved);
      savedQuestionsRef.current = saved;
      setSaveStatus("saved");
      setNewRowIndex(null);
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setError("Failed to save questions. Please try again.");
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const styles = PILLAR_STYLES[topic?.pillarCode ?? "E"];

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell title="">
        <div className="flex items-center justify-between mb-6">
          <div className="h-4 w-48 rounded bg-gray-200 animate-pulse" />
          <div className="h-8 w-32 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </PageShell>
    );
  }

  if (!topic) {
    return (
      <PageShell title="Topic not found">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle size={40} className="text-gray-300" />
          <p className="text-gray-500">{error ?? "The requested topic could not be found."}</p>
          <Button variant="outline" onClick={() => router.push("/admin/topics")}>
            <ArrowLeft size={14} className="mr-1.5" /> Back to Topic Bank
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="">
      {/* Header row: breadcrumb left, save actions right */}
      <div className="flex items-center justify-between mb-6">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button
            onClick={() => {
              if (isDirty && !confirm("You have unsaved changes. Leave anyway?")) return;
              router.push("/admin/topics");
            }}
            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={13} />
            GRI Topic Bank
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-medium">{topic.code} — Questions</span>
        </nav>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
              <RotateCcw size={13} className="mr-1.5" /> Discard
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            className="bg-[#333a8b] hover:bg-[#2a3070] text-white disabled:opacity-40"
          >
            <Save size={13} className="mr-1.5" />
            {saving ? "Saving…" : "Save Questions"}
          </Button>
        </div>
      </div>

      {/* Topic header card */}
      <div className={`rounded-2xl border p-5 mb-6 ${styles?.bg ?? "bg-gray-50"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${styles?.badge ?? ""}`}>
              {topic.code}
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{topic.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`flex items-center gap-1 text-xs font-medium ${styles?.text ?? ""}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${styles?.dot ?? ""}`} />
                  {PILLAR_LABELS[topic.pillarCode] ?? topic.pillar}
                </span>
                {topic.griReference && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-500">{topic.griReference}</span>
                  </>
                )}
                {topic.description && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-500 max-w-md truncate">{topic.description}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
            <p className="text-xs text-muted-foreground">questions</p>
          </div>
        </div>
      </div>

      {/* Status banners */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {saveStatus === "saved" && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 mb-4 text-sm text-green-700">
          <CheckCircle2 size={15} className="shrink-0" />
          Questions saved successfully. Changes will appear in new surveys.
        </div>
      )}
      {isDirty && saveStatus === "idle" && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-sm text-amber-700">
          <AlertCircle size={15} className="shrink-0" />
          You have unsaved changes.
        </div>
      )}

      {/* Questions list */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Survey Questions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            These questions are presented to stakeholders during the materiality survey.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddQuestion}
          className="border-[#333a8b]/30 text-[#333a8b] hover:bg-[#eff2ff] hover:border-[#333a8b]"
        >
          <Plus size={13} className="mr-1.5" />
          Add Question
        </Button>
      </div>

      {questions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Plus size={20} className="text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">No questions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add questions that stakeholders will answer for this GRI topic.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddQuestion}
              className="border-[#333a8b]/30 text-[#333a8b] hover:bg-[#eff2ff]"
            >
              <Plus size={13} className="mr-1.5" /> Add First Question
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {questions.map((q, i) => (
            <QuestionRow
              key={`${i}-${q.id}`}
              question={q}
              index={i}
              total={questions.length}
              pillarCode={topic.pillarCode}
              onChange={handleChange}
              onDelete={handleDelete}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              autoFocus={newRowIndex === i}
            />
          ))}

          {/* Add question inline at the bottom */}
          <button
            onClick={handleAddQuestion}
            className="w-full rounded-xl border-2 border-dashed border-gray-200 py-3.5 text-sm text-gray-400 hover:border-[#333a8b]/40 hover:text-[#333a8b] hover:bg-[#eff2ff]/30 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            Add another question
          </button>
        </div>
      )}

      {/* Bottom save bar — sticky when dirty */}
      {isDirty && (
        <div className="sticky bottom-0 mt-6 -mx-6 px-6 py-4 bg-white/90 backdrop-blur-sm border-t border-gray-200 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
            {" "}— unsaved changes
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
              <RotateCcw size={13} className="mr-1.5" /> Discard
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-[#333a8b] hover:bg-[#2a3070] text-white"
            >
              <Save size={13} className="mr-1.5" />
              {saving ? "Saving…" : "Save Questions"}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
