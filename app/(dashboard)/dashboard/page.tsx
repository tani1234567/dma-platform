"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, Activity, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getCompany, getAssessments } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { Assessment, AssessmentStatus, Company } from "@/types";

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AssessmentStatus }) {
  if (status === AssessmentStatus.COMPLETED) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        Completed
      </span>
    );
  }
  if (status === AssessmentStatus.DRAFT) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Draft
      </span>
    );
  }
  // STAKEHOLDER_SURVEY, SCORING, REVIEW → "Active"
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      Active
    </span>
  );
}

// ─── Assessment card ───────────────────────────────────────────────────────────

function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const total = assessment.stakeholderCount ?? 0;
  const responded = assessment.responseCount ?? 0;
  const pct = total > 0 ? Math.round((responded / total) * 100) : 0;

  const isDraft = assessment.status === AssessmentStatus.DRAFT;
  const href = isDraft
    ? `/dashboard/assessment/${assessment.id}/topics`
    : `/dashboard/assessment/${assessment.id}/results`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-[#eff2ff] text-[#333a8b]">
            FY {assessment.financialYear}
          </span>
          <StatusBadge status={assessment.status} />
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          {responded} of {total} stakeholder{total !== 1 ? "s" : ""} responded
        </p>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-gray-100 mb-4">
          <div
            className="h-1.5 rounded-full bg-[#333a8b] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={href}>{isDraft ? "Continue →" : "View Results →"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-16 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-[#eff2ff] flex items-center justify-center mb-4">
          <ClipboardList size={24} className="text-[#333a8b]" />
        </div>
        <p className="text-base font-semibold text-gray-900 mb-1">No assessments yet</p>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Start your first ESG Double Materiality Assessment to identify material topics for your
          organisation.
        </p>
        <Button asChild variant="orange">
          <Link href="/dashboard/assessment/new">
            <Plus size={16} />
            Start your first ESG Assessment
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !firebaseUser?.uid) return;
    setFetchError(null);
    Promise.all([
      getCompany(firebaseUser.uid),
      getAssessments(firebaseUser.uid),
    ])
      .then(([co, assmts]) => {
        setCompany(co);
        setAssessments(assmts);
      })
      .catch(() => setFetchError("Failed to load dashboard data. Please refresh."))
      .finally(() => setDataLoading(false));
  }, [authLoading, firebaseUser?.uid]);

  if (authLoading || dataLoading) {
    return (
      <div className="p-8 space-y-8">
        <div className="h-32 rounded-xl bg-gray-200 animate-pulse" />
        <LoadingSkeleton variant="card" count={3} />
        <LoadingSkeleton variant="table-row" count={3} />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-8">
        <div className="rounded-md bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
          {fetchError}
        </div>
      </div>
    );
  }

  const activeCount = assessments.filter(
    (a) => a.status !== AssessmentStatus.DRAFT && a.status !== AssessmentStatus.COMPLETED
  ).length;

  const avgResponseRate =
    assessments.length > 0
      ? Math.round(
          assessments.reduce((sum, a) => {
            const total = a.stakeholderCount ?? 0;
            const responded = a.responseCount ?? 0;
            return sum + (total > 0 ? (responded / total) * 100 : 0);
          }, 0) / assessments.length
        )
      : 0;

  return (
    <div className="animate-fade-in">
      {/* Welcome banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#333a8b] to-[#4f46e5] text-white px-8 py-8">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 right-32 w-28 h-28 rounded-full bg-white/[0.06]" />
        <div className="absolute top-4 right-56 w-16 h-16 rounded-full bg-white/[0.08]" />

        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
            Welcome back
          </p>
          <h1 className="text-2xl font-bold">
            {company?.name ?? "Your Dashboard"}
          </h1>
          <p className="text-sm text-white/70 mt-1">
            Double Materiality Assessment Platform
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total Assessments"
            value={assessments.length}
            icon={ClipboardList}
            iconColor="text-[#333a8b]"
            iconBg="bg-[#eff2ff]"
          />
          <StatCard
            label="Active Assessments"
            value={activeCount}
            icon={Activity}
            iconColor="text-[#ff6900]"
            iconBg="bg-orange-50"
          />
          <StatCard
            label="Avg Response Rate"
            value={`${avgResponseRate}%`}
            icon={Users}
            iconColor="text-[#333a8b]"
            iconBg="bg-[#eff2ff]"
          />
        </div>

        {/* Assessments header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Assessments</h2>
          <Button asChild variant="orange" size="sm">
            <Link href="/dashboard/assessment/new">
              <Plus size={15} />
              New Assessment
            </Link>
          </Button>
        </div>

        {/* Assessment list or empty state */}
        {assessments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessments.map((a) => (
              <AssessmentCard key={a.id} assessment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
