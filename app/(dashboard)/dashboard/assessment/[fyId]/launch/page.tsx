"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAssessment,
  getStakeholders,
} from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Assessment, AssessmentStatus, Stakeholder, SurveyTokenStatus } from "@/types";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PILLAR_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  E: { label: "Environmental", bg: "#dcfce7", color: "#166534" },
  S: { label: "Social",         bg: "#dbeafe", color: "#1e40af" },
  G: { label: "Governance",     bg: "#ffedd5", color: "#9a3412" },
};

function groupByPillar(topics: string[]): Record<string, string[]> {
  return topics.reduce<Record<string, string[]>>((acc, code) => {
    const p = code[0] ?? "E";
    acc[p] = [...(acc[p] ?? []), code];
    return acc;
  }, {});
}

function Toast({ message, error }: { message: string; error?: boolean }) {
  return (
    <div
      className={cn(
        "fixed top-20 right-6 z-50 animate-fade-in text-white text-sm px-4 py-2.5 rounded-lg shadow-lg pointer-events-none",
        error ? "bg-red-600" : "bg-gray-900"
      )}
    >
      {message}
    </div>
  );
}

// ─── Checklist card ───────────────────────────────────────────────────────────

function ChecklistCard({
  title,
  valid,
  editHref,
  children,
}: {
  title: string;
  valid: boolean;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {valid ? (
            <CheckCircle size={18} className="text-green-500 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-500 shrink-0" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <Link
          href={editHref}
          className="flex items-center gap-1 text-xs text-[#333a8b] hover:underline"
        >
          Edit <ExternalLink size={11} />
        </Link>
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LaunchPage() {
  const { fyId } = useParams<{ fyId: string }>();
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const companyId = firebaseUser?.uid ?? "";

  useEffect(() => {
    if (authLoading || !companyId) return;
    Promise.all([getAssessment(companyId, fyId), getStakeholders(companyId, fyId)])
      .then(([a, sh]) => { setAssessment(a); setStakeholders(sh); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading, companyId, fyId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Derived validations ──────────────────────────────────────────────────

  const selectedTopics = assessment?.selectedTopics ?? [];
  const topicsOk = selectedTopics.length >= 5;

  const stakeholderCount = stakeholders.length;
  const stakeholdersOk = stakeholderCount > 0;

  const weightages = assessment?.stakeholderWeightages ?? {};
  const weightSum = Object.values(weightages).reduce((s, v) => s + v, 0);
  const weightsOk = Object.keys(weightages).length > 0 && Math.abs(weightSum - 1) < 0.001;

  const allValid = topicsOk && stakeholdersOk && weightsOk;
  const alreadyLaunched = assessment !== null && assessment.status !== AssessmentStatus.DRAFT;
  const pendingStakeholders = stakeholders.filter(s => s.status === SurveyTokenStatus.PENDING);
  const hasPending = pendingStakeholders.length > 0;

  // ── Type breakdown ────────────────────────────────────────────────────────

  const typeBreakdown = stakeholders.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1;
    return acc;
  }, {});

  // ── Launch ────────────────────────────────────────────────────────────────

  async function handleConfirmLaunch() {
    if (!companyId || launching) return;
    setLaunching(true);
    try {
      const res = await fetch("/api/survey/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, fyId }),
      });

      setShowModal(false);

      if (res.ok) {
        const data = (await res.json()) as { emailsSent: number; total: number };
        setToast({
          msg: `Assessment launched! ${data.emailsSent} of ${data.total} survey email${data.total !== 1 ? "s" : ""} sent.`,
        });
      } else {
        setToast({
          msg: "Assessment launched but some emails failed to send.",
          error: true,
        });
      }

      setTimeout(() => {
        router.push(`/dashboard/assessment/${fyId}/results`);
      }, 1800);
    } catch {
      setToast({ msg: "Launch failed. Please try again.", error: true });
      setLaunching(false);
    }
  }

  async function handleSendToNew() {
    if (!companyId || launching) return;
    setLaunching(true);
    try {
      const res = await fetch("/api/survey/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, fyId }),
      });
      const data = (await res.json()) as { emailsSent?: number; total?: number; message?: string };
      if (res.ok) {
        const n = data.emailsSent ?? 0;
        setToast({ msg: n === 0 ? "No new stakeholders to invite." : `${n} invite email${n !== 1 ? "s" : ""} sent to new stakeholders.` });
        // Reload to reflect updated statuses
        const [a, sh] = await Promise.all([
          getAssessment(companyId, fyId),
          getStakeholders(companyId, fyId),
        ]);
        setAssessment(a);
        setStakeholders(sh);
      } else {
        setToast({ msg: data.message ?? "Failed to send invites.", error: true });
      }
    } catch {
      setToast({ msg: "Network error.", error: true });
    } finally {
      setLaunching(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const topicsGrouped = groupByPillar(selectedTopics);

  return (
    <>
      {toast && <Toast message={toast.msg} error={toast.error} />}

      {/* Confirmation modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Launch Assessment?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              This will generate unique survey links for{" "}
              <span className="font-semibold">{stakeholderCount}</span> stakeholder
              {stakeholderCount !== 1 ? "s" : ""}. Once launched, you cannot add or remove topics.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                disabled={launching}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmLaunch}
                disabled={launching}
                className="bg-[#333a8b] hover:bg-[#2a3070] text-white"
              >
                {launching ? "Sending survey emails…" : "Confirm Launch"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-8 pb-28 space-y-6">

        {/* Already-launched banner */}
        {alreadyLaunched && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-blue-600 shrink-0" />
              <p className="text-sm font-medium text-blue-800">
                This assessment has already been launched.
                {hasPending && (
                  <span className="ml-1 text-amber-700 font-semibold">
                    {pendingStakeholders.length} new stakeholder{pendingStakeholders.length !== 1 ? "s" : ""} haven&apos;t received their invite yet.
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {hasPending && (
                <Button
                  size="sm"
                  disabled={launching}
                  onClick={() => void handleSendToNew()}
                  className="bg-[#ff6900] hover:bg-[#e05e00] text-white"
                >
                  {launching
                    ? "Sending…"
                    : `Send Invite${pendingStakeholders.length !== 1 ? "s" : ""} to ${pendingStakeholders.length} New`}
                </Button>
              )}
              <Link
                href={`/dashboard/assessment/${fyId}/results`}
                className="text-sm font-semibold text-blue-700 hover:underline"
              >
                View Results →
              </Link>
            </div>
          </div>
        )}

        {/* Page heading */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Launch Assessment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review the checklist below before sending survey links to stakeholders.
          </p>
        </div>

        {/* Pre-launch checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Card 1 — Topics */}
          <ChecklistCard
            title="Topics Selected"
            valid={topicsOk}
            editHref={`/dashboard/assessment/${fyId}/topics`}
          >
            <p className="text-2xl font-bold text-gray-900 mb-3">
              {selectedTopics.length}
              <span className="text-sm font-normal text-muted-foreground ml-1">topics</span>
            </p>
            {!topicsOk && (
              <p className="text-xs text-red-500 mb-3">Select at least 5 topics.</p>
            )}
            <div className="space-y-2">
              {(["E", "S", "G"] as const).map((p) => {
                const group = topicsGrouped[p];
                if (!group?.length) return null;
                const badge = PILLAR_BADGE[p];
                return (
                  <div key={p}>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold mb-1"
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {group.map((code) => (
                        <span
                          key={code}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 font-medium"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ChecklistCard>

          {/* Card 2 — Stakeholders */}
          <ChecklistCard
            title="Stakeholders"
            valid={stakeholdersOk && weightsOk}
            editHref={`/dashboard/assessment/${fyId}/stakeholders`}
          >
            <p className="text-2xl font-bold text-gray-900 mb-3">
              {stakeholderCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">added</span>
            </p>
            {!stakeholdersOk && (
              <p className="text-xs text-red-500 mb-3">Add at least one stakeholder.</p>
            )}
            {stakeholderCount > 0 && (
              <table className="w-full text-xs mb-3">
                <thead>
                  <tr className="text-gray-400">
                    <th className="text-left pb-1 font-medium">Type</th>
                    <th className="text-right pb-1 font-medium">Count</th>
                    <th className="text-right pb-1 font-medium">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(typeBreakdown).map(([type, count]) => (
                    <tr key={type}>
                      <td className="py-1 text-gray-700">{type}</td>
                      <td className="py-1 text-right text-gray-700">{count}</td>
                      <td className="py-1 text-right text-gray-500">
                        {((weightages[type] ?? 0) * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {Object.keys(weightages).length > 0 && (
              <p className={cn("text-xs font-medium", weightsOk ? "text-green-600" : "text-red-500")}>
                {weightsOk
                  ? "✓ Weights sum to 100%"
                  : `✗ Weights sum to ${(weightSum * 100).toFixed(0)}% — must equal 100%`}
              </p>
            )}
          </ChecklistCard>

          {/* Card 3 — Survey Settings */}
          <ChecklistCard
            title="Survey Settings"
            valid={true}
            editHref={`/dashboard/assessment/${fyId}/stakeholders`}
          >
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Link expiry</dt>
                <dd className="font-medium text-gray-900">
                  {assessment?.surveyLinkExpiryDays ?? 45} days from launch date
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Estimated time</dt>
                <dd className="font-medium text-gray-900">10–15 minutes per stakeholder</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Language</dt>
                <dd className="font-medium text-gray-900">English</dd>
              </div>
            </dl>
          </ChecklistCard>
        </div>

        {/* Validation errors banner */}
        {!alreadyLaunched && !allValid && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 mb-1">
                  Fix the following before launching:
                </p>
                <ul className="text-sm text-red-700 space-y-0.5 list-disc list-inside">
                  {!topicsOk && <li>Select at least 5 topics (currently {selectedTopics.length})</li>}
                  {!stakeholdersOk && <li>Add at least one stakeholder</li>}
                  {!weightsOk && <li>Stakeholder weights must sum to 100%</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Launch button */}
        {!alreadyLaunched && (
          <div className="flex justify-center pt-2">
            <Button
              disabled={!allValid || launching}
              onClick={() => setShowModal(true)}
              className="bg-[#ff6900] hover:bg-[#e05e00] text-white rounded-xl px-8 py-4 text-lg font-semibold h-auto w-full max-w-md shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🚀 Launch Assessment &amp; Send Survey Links
            </Button>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-[220px] right-0 z-40 bg-white border-t border-border shadow-lg px-6 py-4 flex items-center justify-between">
        <span />
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/assessment/${fyId}/stakeholders`}>
              ← Back to Stakeholders
            </Link>
          </Button>
          {alreadyLaunched && (
            <Button variant="orange" asChild>
              <Link href={`/dashboard/assessment/${fyId}/results`}>
                View Results →
              </Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
