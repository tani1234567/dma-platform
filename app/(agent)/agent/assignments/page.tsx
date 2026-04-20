"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Users,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StakeholderItem {
  id: string;
  name: string;
  email: string;
  type: string;
  weight: number;
  status: string;
  topicCount: number;
  assignedTopics: string[];
  organisation: string;
  isProxySubmission: boolean;
  proxyAgentUid: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Management:    "bg-purple-100 text-purple-700",
  Employees:     "bg-blue-100 text-blue-700",
  Customers:     "bg-green-100 text-green-700",
  Suppliers:     "bg-amber-100 text-amber-700",
  Community:     "bg-pink-100 text-pink-700",
  Investors:     "bg-indigo-100 text-indigo-700",
  "Experts/NGOs":"bg-teal-100 text-teal-700",
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

type FilterTab = "all" | "pending" | "completed";

// ─── Inner component (needs useSearchParams) ──────────────────────────────────

function AssignmentsInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("assessmentId") ?? "";

  const [stakeholders, setStakeholders] = useState<StakeholderItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState("");
  const [tab, setTab]                   = useState<FilterTab>("all");
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!assessmentId || hasFetched.current) return;
    hasFetched.current = true;

    void fetch(`/api/agent/stakeholders?assessmentId=${assessmentId}`)
      .then(async r => {
        if (r.status === 401) { router.replace("/login"); return; }
        const d = await r.json() as { stakeholders: StakeholderItem[] } | { error: string };
        if ("error" in d) { setError("Failed to load assignments."); return; }
        setStakeholders(d.stakeholders);
      })
      .catch(() => setError("Failed to load assignments."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  // Filter
  const filtered = stakeholders.filter(s => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.type.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      tab === "all" ||
      (tab === "pending" && s.status !== "completed") ||
      (tab === "completed" && s.status === "completed");
    return matchSearch && matchTab;
  });

  const pendingCount   = stakeholders.filter(s => s.status !== "completed").length;
  const completedCount = stakeholders.filter(s => s.status === "completed").length;

  return (
    <PageShell title="Assignments" description="Submit surveys on behalf of stakeholders">
      {/* Back */}
      <button
        onClick={() => router.push("/agent")}
        className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-5 transition-colors"
      >
        ← Back to Dashboard
      </button>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {!assessmentId && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <AlertCircle size={32} className="text-gray-300" />
          <p className="text-sm text-gray-500">No assessment selected.</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/agent")}>
            Back to Dashboard
          </Button>
        </div>
      )}

      {assessmentId && (
        <>
          {/* Tabs + Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(["all", "pending", "completed"] as FilterTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                    tab === t
                      ? "bg-white text-[#333a8b] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t}
                  {t === "pending" && pendingCount > 0 && (
                    <span className="ml-1.5 bg-[#ff6900] text-white text-[10px] rounded-full px-1.5 py-0.5">
                      {pendingCount}
                    </span>
                  )}
                  {t === "completed" && completedCount > 0 && (
                    <span className="ml-1.5 bg-green-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                      {completedCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-60">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, type…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4">
                      <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-36 rounded bg-gray-200 animate-pulse" />
                        <div className="h-3 w-48 rounded bg-gray-200 animate-pulse" />
                      </div>
                      <div className="h-7 w-24 rounded bg-gray-200 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
                  <Users size={32} className="text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">
                    {search ? "No stakeholders match your search." : "No stakeholders in this view."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-gray-50/60">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Stakeholder
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                        Type
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                        Topics
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(s => {
                      const isPending = s.status !== "completed";
                      return (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          {/* Stakeholder */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-[#eff2ff] flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-[#333a8b]">{initials(s.name)}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate">{s.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                              </div>
                            </div>
                          </td>
                          {/* Type */}
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[s.type] ?? "bg-gray-100 text-gray-600"}`}>
                              {s.type}
                            </span>
                          </td>
                          {/* Topics */}
                          <td className="px-4 py-3.5 text-center text-gray-700 font-medium hidden sm:table-cell">
                            {s.topicCount}
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3.5 text-center">
                            {s.status === "completed" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={10} />
                                {s.isProxySubmission ? "Proxy" : "Submitted"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff6900] bg-orange-50 px-2 py-0.5 rounded-full">
                                <Clock size={10} />
                                Pending
                              </span>
                            )}
                          </td>
                          {/* Action */}
                          <td className="px-5 py-3.5 text-right">
                            {isPending ? (
                              <Button
                                size="sm"
                                onClick={() =>
                                  router.push(
                                    `/agent/assignments/${s.id}?assessmentId=${assessmentId}`
                                  )
                                }
                                className="bg-[#333a8b] hover:bg-[#2a3070] text-white text-xs h-7 px-3"
                              >
                                Submit Survey
                                <ArrowRight size={11} className="ml-1" />
                              </Button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <UserCheck size={12} />
                                Done
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Summary footer */}
          {!loading && stakeholders.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-right">
              Showing {filtered.length} of {stakeholders.length} stakeholders
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}

// ─── Page export wrapped in Suspense (required for useSearchParams) ───────────

export default function AssignmentsPage() {
  return (
    <Suspense>
      <AssignmentsInner />
    </Suspense>
  );
}
