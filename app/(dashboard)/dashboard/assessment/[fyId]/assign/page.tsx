"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  getAssessment,
  getStakeholders,
  updateStakeholderDoc,
} from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Assessment, Stakeholder } from "@/types";
import { TOPIC_SUGGESTIONS_BY_TYPE } from "@/lib/topicSuggestions";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const PILLAR_BADGE: Record<string, { label: string; short: string; bg: string; color: string }> = {
  E: { label: "Environmental", short: "Env",    bg: "#dcfce7", color: "#166534" },
  S: { label: "Social",        short: "Social", bg: "#dbeafe", color: "#1e40af" },
  G: { label: "Governance",    short: "Gov",    bg: "#ffedd5", color: "#9a3412" },
};

type PillarFilter = "ALL" | "E" | "S" | "G";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssignPage() {
  const { fyId } = useParams<{ fyId: string }>();
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>("ALL");
  const [toast, setToast] = useState<string | null>(null);

  // Track pending saves to debounce rapid topic toggles
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const companyId = firebaseUser?.uid ?? "";

  useEffect(() => {
    if (authLoading || !companyId) return;
    Promise.all([getAssessment(companyId, fyId), getStakeholders(companyId, fyId)])
      .then(([a, sh]) => {
        setAssessment(a);
        setStakeholders(sh);
        if (sh.length > 0) setSelectedId(sh[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading, companyId, fyId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedTopics = assessment?.selectedTopics ?? [];
  const selectedStakeholder = stakeholders.find((s) => s.id === selectedId) ?? null;

  const filteredTopics =
    pillarFilter === "ALL"
      ? selectedTopics
      : selectedTopics.filter((code) => code[0] === pillarFilter);

  const assignedCount = selectedStakeholder?.assignedTopics?.length ?? 0;
  const progressCount = stakeholders.filter(
    (s) => (s.assignedTopics?.length ?? 0) > 0
  ).length;

  // ── Save helpers ──────────────────────────────────────────────────────────

  async function persistAssignment(stakeholderId: string, topics: string[]) {
    if (!companyId) return;
    setSavingId(stakeholderId);
    try {
      await updateStakeholderDoc(companyId, fyId, stakeholderId, {
        assignedTopics: topics,
      });
    } catch {
      setToast("Failed to save — please try again.");
    } finally {
      setSavingId(null);
    }
  }

  function updateLocal(stakeholderId: string, topics: string[]) {
    setStakeholders((prev) =>
      prev.map((s) => (s.id === stakeholderId ? { ...s, assignedTopics: topics } : s))
    );
  }

  // Toggle a topic for the selected stakeholder (optimistic + debounced save)
  function toggleTopic(topicCode: string) {
    if (!selectedStakeholder) return;
    const current = selectedStakeholder.assignedTopics ?? [];
    const next = current.includes(topicCode)
      ? current.filter((c) => c !== topicCode)
      : [...current, topicCode];

    updateLocal(selectedStakeholder.id, next);

    // Debounce: cancel any pending save for this stakeholder, schedule new one
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      void persistAssignment(selectedStakeholder.id, next);
    }, 600);
  }

  // Apply suggestions for a single stakeholder
  function applysuggested(stakeholder: Stakeholder) {
    const suggested = (TOPIC_SUGGESTIONS_BY_TYPE[stakeholder.type] ?? []).filter(
      (code) => selectedTopics.includes(code)
    );
    updateLocal(stakeholder.id, suggested);
    void persistAssignment(stakeholder.id, suggested);
  }

  // Apply suggestions for ALL stakeholders
  async function assignAllSuggested() {
    for (const s of stakeholders) {
      const suggested = (TOPIC_SUGGESTIONS_BY_TYPE[s.type] ?? []).filter(
        (code) => selectedTopics.includes(code)
      );
      updateLocal(s.id, suggested);
      await updateStakeholderDoc(companyId, fyId, s.id, { assignedTopics: suggested });
    }
    setToast("Suggested topics applied to all stakeholders.");
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      <div className="p-8 pb-28">
        {/* Heading */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Topic Assignment</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assign relevant topics to each stakeholder. They will only see their assigned
              topics in the survey.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void assignAllSuggested()}
            className="shrink-0"
          >
            Assign All (Suggested)
          </Button>
        </div>

        {stakeholders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No stakeholders found.{" "}
              <Link
                href={`/dashboard/assessment/${fyId}/stakeholders`}
                className="text-[#333a8b] hover:underline"
              >
                Add stakeholders first.
              </Link>
            </p>
          </div>
        ) : (
          <div className="flex gap-5 min-h-[520px]">
            {/* ── Left: stakeholder list ──────────────────────────────────── */}
            <div className="w-64 shrink-0 space-y-2">
              {stakeholders.map((s) => {
                const count = s.assignedTopics?.length ?? 0;
                const isSelected = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "w-full text-left rounded-xl border px-4 py-3.5 transition-colors",
                      isSelected
                        ? "border-[#333a8b] bg-[#eff2ff]"
                        : "border-border bg-white hover:border-gray-300"
                    )}
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.type}</p>
                    <p
                      className={cn(
                        "text-xs font-medium mt-2",
                        count > 0 ? "text-[#333a8b]" : "text-gray-400"
                      )}
                    >
                      {count > 0
                        ? `${count} topic${count !== 1 ? "s" : ""} assigned`
                        : "None assigned"}
                    </p>
                    {savingId === s.id && (
                      <p className="text-[10px] text-gray-400 mt-0.5">Saving…</p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Right: topic grid ───────────────────────────────────────── */}
            <div className="flex-1 bg-white rounded-xl border border-border p-6 min-w-0">
              {!selectedStakeholder ? (
                <p className="text-sm text-muted-foreground">
                  Select a stakeholder to assign topics.
                </p>
              ) : (
                <>
                  {/* Stakeholder header */}
                  <div className="flex items-start justify-between mb-5 gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        {selectedStakeholder.name}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedStakeholder.type} &middot;{" "}
                        <span className="font-medium text-[#333a8b]">
                          {assignedCount}
                        </span>{" "}
                        of {selectedTopics.length} topics assigned
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applysuggested(selectedStakeholder)}
                      className="shrink-0"
                    >
                      Apply Suggested
                    </Button>
                  </div>

                  {/* Pillar filter tabs */}
                  <div className="flex gap-1.5 mb-4">
                    {(["ALL", "E", "S", "G"] as const).map((p) => {
                      const badge = p !== "ALL" ? PILLAR_BADGE[p] : null;
                      return (
                        <button
                          key={p}
                          onClick={() => setPillarFilter(p)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                            pillarFilter === p
                              ? "bg-[#333a8b] text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                        >
                          {p === "ALL" ? "All Topics" : badge?.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Topic grid */}
                  {filteredTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No topics in this pillar are selected for this assessment.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {filteredTopics.map((code) => {
                        const pillarCode = code[0] ?? "E";
                        const badge = PILLAR_BADGE[pillarCode];
                        const isAssigned =
                          selectedStakeholder.assignedTopics?.includes(code) ?? false;
                        return (
                          <button
                            key={code}
                            onClick={() => toggleTopic(code)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all",
                              isAssigned
                                ? "border-[#333a8b] bg-[#eff2ff] shadow-sm"
                                : "border-border bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                            )}
                          >
                            {/* Checkbox indicator */}
                            <span
                              className={cn(
                                "w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors",
                                isAssigned
                                  ? "bg-[#333a8b] border-[#333a8b]"
                                  : "border-gray-300 bg-white"
                              )}
                            >
                              {isAssigned && (
                                <svg
                                  width="10"
                                  height="8"
                                  viewBox="0 0 10 8"
                                  fill="none"
                                >
                                  <path
                                    d="M1 4L3.5 6.5L9 1"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900">{code}</p>
                              {badge && (
                                <span
                                  className="inline-block px-1 py-0.5 rounded text-[9px] font-semibold mt-0.5 leading-none"
                                  style={{ backgroundColor: badge.bg, color: badge.color }}
                                >
                                  {badge.short}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-[220px] right-0 z-40 bg-white border-t border-border shadow-lg px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-bold text-[#333a8b]">{progressCount}</span> of{" "}
          <span className="font-bold">{stakeholders.length}</span> stakeholder
          {stakeholders.length !== 1 ? "s" : ""} have assigned topics
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/assessment/${fyId}/stakeholders`}>
              ← Back to Stakeholders
            </Link>
          </Button>
          <Button
            variant="orange"
            onClick={() => router.push(`/dashboard/assessment/${fyId}/launch`)}
          >
            Continue to Launch →
          </Button>
        </div>
      </div>
    </>
  );
}
