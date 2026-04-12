"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface CompanyListItem {
  id: string;
  name: string;
  industry?: string;
  country?: string;
  status?: string;
  assessmentCount: number;
  createdAt: string;
}

const PAGE_SIZE = 10;

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    void fetch("/api/admin/companies")
      .then(r => r.json())
      .then((d: { companies: CompanyListItem[] } | { error: string }) => {
        if ("error" in d) return;
        setCompanies(d.companies);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = companies;
    if (statusFilter !== "all") list = list.filter(c => (c.status ?? "active") === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q) ||
        (c.country ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [companies, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleStatus(v: "all" | "active" | "suspended") { setStatusFilter(v); setPage(1); }

  return (
    <PageShell
      title="Company Management"
      description={`${companies.length} companies registered on the platform`}
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, industry…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "suspended"] as const).map(v => (
            <button
              key={v}
              onClick={() => handleStatus(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === v
                  ? "bg-[#333a8b] text-white"
                  : "bg-white border border-border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-40 rounded bg-gray-200 animate-pulse" />
                    <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              {search || statusFilter !== "all" ? "No companies match your filters." : "No companies registered yet."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Industry</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assessments</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/companies/${c.id}`} className="flex items-center gap-2.5 group">
                        <div className="h-8 w-8 rounded-full bg-[#eff2ff] flex items-center justify-center shrink-0">
                          <Building2 size={14} className="text-[#333a8b]" />
                        </div>
                        <span className="font-medium text-gray-900 group-hover:text-[#333a8b] transition-colors">
                          {c.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 hidden md:table-cell">{c.industry ?? "—"}</td>
                    <td className="px-4 py-3.5 text-center font-medium text-gray-700">{c.assessmentCount}</td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge
                        variant={c.status === "suspended" ? "destructive" : "secondary"}
                        className={c.status === "suspended" ? "" : "bg-green-100 text-green-700 hover:bg-green-100"}
                      >
                        {c.status === "suspended" ? "Suspended" : "Active"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-500 text-xs">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded border border-border text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded border border-border text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
