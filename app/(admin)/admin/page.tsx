"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ClipboardList, Users, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Stats {
  totalCompanies: number;
  activeAssessments: number;
  totalResponses: number;
  totalStakeholders: number;
}

interface ActivityItem {
  type: "company_registered" | "assessment_launched";
  label: string;
  sub: string;
  ts: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface StatCardProps {
  label: string;
  value: number | null;
  icon: React.ElementType;
  color: string;
  bg: string;
}

function StatCard({ label, value, icon: Icon, color, bg }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`rounded-full p-2.5 ${bg}`}>
          <Icon size={20} className={color} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          {value === null ? (
            <div className="h-7 w-12 rounded bg-gray-200 animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    void fetch("/api/admin/stats")
      .then(async (r) => {
        if (r.status === 401) { router.replace("/login"); return; }
        const d = await r.json() as { totalCompanies: number; activeAssessments: number; totalResponses: number; totalStakeholders: number } | { error: string };
        if ("error" in d) { setError("Failed to load stats."); return; }
        setStats(d);
      })
      .catch(() => setError("Failed to load stats."));

    void fetch("/api/admin/activity")
      .then(async (r) => {
        if (r.status === 401) return;
        const d = await r.json() as { activity: ActivityItem[] } | { error: string };
        if ("error" in d) return;
        setActivity(d.activity);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  return (
    <PageShell
      title="Super Admin Dashboard"
      description="Platform-wide overview and recent activity"
    >
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Companies"
          value={stats?.totalCompanies ?? null}
          icon={Building2}
          color="text-[#333a8b]"
          bg="bg-[#eff2ff]"
        />
        <StatCard
          label="Active Assessments"
          value={stats?.activeAssessments ?? null}
          icon={ClipboardList}
          color="text-[#ff6900]"
          bg="bg-orange-50"
        />
        <StatCard
          label="Total Responses"
          value={stats?.totalResponses ?? null}
          icon={BarChart3}
          color="text-green-600"
          bg="bg-green-50"
        />
        <StatCard
          label="Active Stakeholders"
          value={stats?.totalStakeholders ?? null}
          icon={Users}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      {/* Activity feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity === null ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-48 rounded bg-gray-200 animate-pulse" />
                    <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((item, i) => {
                const Icon = item.type === "company_registered" ? Building2 : ClipboardList;
                const bg = item.type === "company_registered" ? "bg-[#eff2ff]" : "bg-orange-50";
                const color = item.type === "company_registered" ? "text-[#333a8b]" : "text-[#ff6900]";
                return (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`rounded-full p-1.5 mt-0.5 shrink-0 ${bg}`}>
                      <Icon size={14} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(item.ts)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
