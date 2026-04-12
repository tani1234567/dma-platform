"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle, XCircle } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CompanyDetail {
  id: string;
  name: string;
  cinNumber?: string;
  industry?: string;
  address?: string;
  country?: string;
  status?: string;
  logoURL?: string;
  totalWaterUsage_FY?: number;
  totalElectricityConsumption_FY?: number;
  totalFuelConsumption_FY?: number;
  fuelUnit?: string;
}

interface AssessmentItem {
  id: string;
  financialYear: string;
  status: string;
  responseCount: number;
  stakeholderCount: number;
  responseRate: number;
  launchedAt: string | null;
  createdAt: string;
}

interface UserItem {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
}

interface CompanyDetailData {
  company: CompanyDetail;
  assessments: AssessmentItem[];
  adminUser: UserItem | null;
  agentUsers: UserItem[];
}

type Tab = "profile" | "assessments" | "users";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Draft",     cls: "bg-gray-100 text-gray-600" },
  stakeholder_survey: { label: "Live",      cls: "bg-blue-100 text-blue-700" },
  scoring:            { label: "Scoring",   cls: "bg-purple-100 text-purple-700" },
  review:             { label: "Review",    cls: "bg-yellow-100 text-yellow-700" },
  completed:          { label: "Completed", cls: "bg-green-100 text-green-700" },
};

export default function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);
  const [data, setData] = useState<CompanyDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("profile");
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/admin/companies/${companyId}`)
      .then(r => r.json())
      .then((d: CompanyDetailData | { error: string }) => {
        if ("error" in d) { setError("Company not found."); return; }
        setData(d);
      })
      .catch(() => setError("Failed to load company."))
      .finally(() => setLoading(false));
  }, [companyId]);

  async function toggleStatus() {
    if (!data) return;
    const next = data.company.status === "suspended" ? "active" : "suspended";
    setTogglingStatus(true);
    try {
      const r = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (r.ok) {
        setData(prev => prev
          ? { ...prev, company: { ...prev.company, status: next } }
          : prev
        );
      }
    } finally {
      setTogglingStatus(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile",     label: "Profile" },
    { key: "assessments", label: `Assessments (${data?.assessments.length ?? 0})` },
    { key: "users",       label: `Users (${(data ? 1 + data.agentUsers.length : 0)})` },
  ];

  return (
    <PageShell
      title={loading ? "Loading…" : (data?.company.name ?? "Company")}
      description="Company detail — profile, assessments, and users"
      actions={
        <Link
          href="/admin/companies"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gray-900"
        >
          <ArrowLeft size={14} /> Back
        </Link>
      }
    >
      {error ? (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Header bar */}
          <div className="flex items-center gap-4 mb-5">
            <div className="h-12 w-12 rounded-full bg-[#eff2ff] flex items-center justify-center shrink-0">
              <Building2 size={22} className="text-[#333a8b]" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">{data.company.name}</h2>
              <p className="text-sm text-muted-foreground">{data.company.industry ?? "—"} · {data.company.country ?? "—"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={data.company.status === "suspended" ? "destructive" : "secondary"}
                className={data.company.status === "suspended" ? "" : "bg-green-100 text-green-700 hover:bg-green-100"}
              >
                {data.company.status === "suspended" ? "Suspended" : "Active"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void toggleStatus()}
                disabled={togglingStatus}
                className={data.company.status === "suspended"
                  ? "border-green-300 text-green-700 hover:bg-green-50"
                  : "border-red-300 text-red-600 hover:bg-red-50"
                }
              >
                {data.company.status === "suspended" ? "Reactivate" : "Suspend"}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border mb-5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-[#333a8b] text-[#333a8b]"
                    : "border-transparent text-muted-foreground hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Profile tab */}
          {tab === "profile" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ["CIN Number",   data.company.cinNumber ?? "—"],
                ["Industry",     data.company.industry ?? "—"],
                ["Address",      data.company.address ?? "—"],
                ["Country",      data.company.country ?? "—"],
                ["Water Usage",  data.company.totalWaterUsage_FY != null ? `${data.company.totalWaterUsage_FY.toLocaleString()} kL` : "—"],
                ["Electricity",  data.company.totalElectricityConsumption_FY != null ? `${data.company.totalElectricityConsumption_FY.toLocaleString()} kWh` : "—"],
                ["Fuel Consumption", data.company.totalFuelConsumption_FY != null ? `${data.company.totalFuelConsumption_FY.toLocaleString()} ${data.company.fuelUnit ?? ""}` : "—"],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardContent className="px-5 py-3.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-sm text-gray-900">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Assessments tab */}
          {tab === "assessments" && (
            <Card>
              <CardContent className="p-0">
                {data.assessments.length === 0 ? (
                  <p className="text-center py-12 text-sm text-muted-foreground">No assessments found.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gray-50/50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">FY</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response Rate</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.assessments.map(a => {
                        const badge = STATUS_BADGE[a.status] ?? { label: a.status, cls: "bg-gray-100 text-gray-600" };
                        return (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3.5 font-medium text-gray-900">{a.financialYear}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="text-gray-700">{a.responseRate}%</span>
                              <span className="text-xs text-muted-foreground ml-1">({a.responseCount}/{a.stakeholderCount})</span>
                            </td>
                            <td className="px-5 py-3.5 text-right text-xs text-gray-500">
                              {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Users tab */}
          {tab === "users" && (
            <div className="space-y-3">
              {data.adminUser && (
                <UserRow user={data.adminUser} badge="Company Admin" badgeCls="bg-[#eff2ff] text-[#333a8b]" />
              )}
              {data.agentUsers.length === 0 && !data.adminUser && (
                <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No users found.</CardContent></Card>
              )}
              {data.agentUsers.map(u => (
                <UserRow key={u.uid} user={u} badge="Field Agent" badgeCls="bg-orange-50 text-orange-700" />
              ))}
            </div>
          )}
        </>
      ) : null}
    </PageShell>
  );
}

function UserRow({ user, badge, badgeCls }: { user: UserItem; badge: string; badgeCls: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 px-5 py-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-medium text-gray-900 text-sm">{user.displayName}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeCls}`}>{badge}</span>
          </div>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user.isActive !== false ? (
            <CheckCircle size={14} className="text-green-600" />
          ) : (
            <XCircle size={14} className="text-red-500" />
          )}
          <span className="text-xs text-muted-foreground">
            {user.isActive !== false ? "Active" : "Revoked"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
