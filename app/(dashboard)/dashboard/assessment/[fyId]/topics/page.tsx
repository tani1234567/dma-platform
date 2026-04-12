"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getGRITopics, getAssessment, updateAssessment } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRITopic } from "@/types";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

type PillarCode = "E" | "S" | "G";

const TABS: { code: PillarCode; label: string }[] = [
  { code: "E", label: "Environmental (E)" },
  { code: "S", label: "Social (S)" },
  { code: "G", label: "Governance (G)" },
];

const PILLAR_BADGE: Record<PillarCode, { bg: string; color: string }> = {
  E: { bg: "#dcfce7", color: "#166534" },
  S: { bg: "#dbeafe", color: "#1e40af" },
  G: { bg: "#ffedd5", color: "#9a3412" },
};

const MIN_TOPICS = 5;

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  isSelected,
  onToggle,
}: {
  topic: GRITopic;
  isSelected: boolean;
  onToggle: (code: string) => void;
}) {
  const badge = PILLAR_BADGE[topic.pillarCode as PillarCode] ?? PILLAR_BADGE.E;

  return (
    <button
      type="button"
      onClick={() => onToggle(topic.code)}
      className={cn(
        "rounded-xl p-4 text-left cursor-pointer transition-all w-full",
        isSelected
          ? "border-2 border-[#333a8b] bg-[#eff2ff] shadow-md"
          : "border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-gray-300"
      )}
    >
      {/* Top row: pillar badge + GRI reference */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="px-2 py-0.5 rounded text-xs font-semibold"
          style={{ backgroundColor: badge.bg, color: badge.color }}
        >
          {topic.code}
        </span>
        <span className="text-[10px] text-gray-400">{topic.griReference}</span>
      </div>

      {/* Topic name */}
      <p className="text-sm font-semibold text-gray-900 mb-1 leading-snug">
        {topic.name}
      </p>

      {/* Description — 2 lines max */}
      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
        {topic.description}
      </p>

      {/* Checkmark when selected */}
      {isSelected && (
        <div className="flex justify-end mt-2">
          <Check size={16} className="text-[#333a8b]" />
        </div>
      )}
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-20 right-6 z-50 animate-fade-in bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg pointer-events-none">
      {message}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopicsPage() {
  const { fyId } = useParams<{ fyId: string }>();
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [topics, setTopics] = useState<GRITopic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<PillarCode>("E");
  const [search, setSearch] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Load topics + pre-existing selections
  useEffect(() => {
    if (authLoading || !firebaseUser?.uid) return;
    Promise.all([
      getGRITopics(),
      getAssessment(firebaseUser.uid, fyId),
    ])
      .then(([fetchedTopics, assessment]) => {
        setTopics(fetchedTopics);
        setSelectedTopics(assessment?.selectedTopics ?? []);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [authLoading, firebaseUser?.uid, fyId]);

  // Auto-dismiss toast after 3 s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  function toggleTopic(code: string) {
    setSelectedTopics((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function handleSave(navigate: boolean) {
    if (!firebaseUser?.uid) return;
    setSaving(true);
    try {
      await updateAssessment(firebaseUser.uid, fyId, { selectedTopics });
      setToast("Topics saved successfully");
      if (navigate) {
        router.push(`/dashboard/assessment/${fyId}/stakeholders`);
      }
    } catch {
      setToast("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Topics visible in the active tab, filtered by search
  const visibleTopics = topics.filter((t) => {
    if (t.pillarCode !== activeTab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
  });

  if (authLoading || dataLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading topics…</p>
      </div>
    );
  }

  return (
    <>
      {toast && <Toast message={toast} />}

      {/* Main content — extra bottom padding for the sticky bar */}
      <div className="p-8 pb-28">
        {/* Heading row */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Select Material Topics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Choose the ESG topics relevant to your organisation. Stakeholders will rate each
              selected topic.
            </p>
          </div>
          {selectedTopics.length > 0 && (
            <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold bg-[#ff6900] text-white">
              {selectedTopics.length} topic{selectedTopics.length !== 1 ? "s" : ""} selected
            </span>
          )}
        </div>

        {/* Search — filters across all tabs */}
        <div className="mb-5">
          <Input
            type="search"
            placeholder="Search by topic name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Pillar tabs */}
        <div className="flex border-b border-border mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.code}
              type="button"
              onClick={() => setActiveTab(tab.code)}
              className={cn(
                "px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.code
                  ? "border-[#333a8b] text-[#333a8b]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Topic grid */}
        {visibleTopics.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            No topics match your search.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTopics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                isSelected={selectedTopics.includes(topic.code)}
                onToggle={toggleTopic}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-[220px] right-0 z-40 bg-white border-t border-border shadow-lg px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-bold text-[#333a8b]">{selectedTopics.length}</span>
          {" "}of {topics.length} topics selected
        </p>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Draft"}
          </Button>

          {/* Wrapper div carries the tooltip when button is disabled */}
          <div
            title={
              selectedTopics.length < MIN_TOPICS
                ? `Select at least ${MIN_TOPICS} topics`
                : undefined
            }
          >
            <Button
              variant="orange"
              onClick={() => handleSave(true)}
              disabled={saving || selectedTopics.length < MIN_TOPICS}
            >
              Save &amp; Continue →
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
