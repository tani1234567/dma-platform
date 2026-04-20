"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Users,
  ArrowRight,
  TrendingUp,
  Building2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Overview {
  company: { id: string; name: string; industry: string };
  assessment: {
    id: string;
    financialYear: string;
    status: string;
    launchedAt: string | null;
  } | null;
  stats: {
    total: number;
    completed: number;
    pending: number;
    byAgent: number;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  stakeholder_survey: "Survey Active",
  scoring:            "Scoring",
  review:             "Under Review",
  completed:          "Completed",
};

const STATUS_COLOR: Record<string, string> = {
  stakeholder_survey: "bg-green-100 text-green-700",
  scoring:            "bg-blue-100 text-blue-700",
  review:             "bg-amber-100 text-amber-700",
  completed:          "bg-gray-100 text-gray-600",
};

export default function AgentDashboardPage() {
  const router = useRouter();
  const { userDoc, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    void fetch("/api/agent/overview")
      .then(async r => {
        if (r.status === 401) { router.replace("/login"); return; }
        const d = await r.json() as Overview | { error: string };
        if ("error" in d) { setError("Failed to load dashboard."); return; }
        setOverview(d);
      })
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const stats   = overview?.stats;
  const company = overview?.company;
  const asm     = overview?.assessment;
  const rate    = stats && stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  return (
    <PageShell
      title={`Hello, ${userDoc?.displayName ?? "Agent"} 👋`}
      description={company ? `Assigned to ${company.name}` : "Loading company…"}
    >
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-6 text-sm text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Assessment banner */}
      {!loading && (
        <div className="mb-6">
          {asm ? (
            <div className="rounded-2xl border bg-gradient-to-br from-[#eff2ff] to-white p-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[asm.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[asm.status] ?? asm.status}
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  FY {asm.financialYear} Assessment
                </p>
                {asm.launchedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Launched {new Date(asm.launchedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
              <Building2 size={32} className="text-[#333a8b]/20 shrink-0 mt-1" />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <ClipboardList size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-600">No active assessment</p>
              <p className="text-xs text-muted-foreground mt-1">
                The company admin hasn't launched a survey yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Total Stakeholders",
            value: stats?.total ?? null,
            icon: Users,
            color: "text-[#333a8b]",
            bg: "bg-[#eff2ff]",
          },
          {
            label: "Pending",
            value: stats?.pending ?? null,
            icon: Clock,
            color: "text-[#ff6900]",
            bg: "bg-orange-50",
          },
          {
            label: "Completed",
            value: stats?.completed ?? null,
            icon: CheckCircle2,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "My Submissions",
            value: stats?.byAgent ?? null,
            icon: TrendingUp,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`rounded-full p-2 ${bg} shrink-0`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                  {label}
                </p>
                {value === null || loading ? (
                  <div className="h-6 w-10 rounded bg-gray-200 animate-pulse mt-0.5" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress bar */}
      {stats && stats.total > 0 && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800">Overall Response Rate</p>
              <p className="text-sm font-bold text-[#333a8b]">{rate}%</p>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#333a8b] transition-all duration-500"
                style={{ width: `${rate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {stats.completed} of {stats.total} stakeholders have submitted
            </p>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      {asm && stats && stats.pending > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pending Submissions</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-3xl font-bold text-[#ff6900]">{stats.pending}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                stakeholders haven't submitted yet
              </p>
            </div>
            <Button
              onClick={() => router.push(`/agent/assignments?assessmentId=${asm.id}`)}
              className="bg-[#333a8b] hover:bg-[#2a3070] text-white shrink-0"
            >
              View Assignments
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {asm && stats && stats.pending === 0 && stats.total > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
            <CheckCircle2 size={36} className="text-green-500" />
            <p className="text-sm font-semibold text-gray-800">All surveys completed!</p>
            <p className="text-xs text-muted-foreground">Every stakeholder has submitted their response.</p>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
