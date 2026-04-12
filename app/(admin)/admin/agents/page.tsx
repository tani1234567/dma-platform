"use client";

import { useEffect, useState } from "react";
import { Plus, UserX, UserCheck, Search } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface AgentItem {
  uid: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  isActive: boolean;
  createdAt: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);

  // Modal form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formCompanyId, setFormCompanyId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/agents")
      .then(r => r.json())
      .then((d: { agents: AgentItem[] } | { error: string }) => {
        if ("error" in d) return;
        setAgents(d.agents);
      })
      .finally(() => setLoading(false));

    void fetch("/api/admin/companies")
      .then(r => r.json())
      .then((d: { companies: { id: string; name: string }[] } | { error: string }) => {
        if ("error" in d) return;
        setCompanies(d.companies.map(c => ({ id: c.id, name: c.name })));
      });
  }, []);

  const filtered = search.trim()
    ? agents.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase()) ||
        a.companyName.toLowerCase().includes(search.toLowerCase())
      )
    : agents;

  async function toggleAgent(uid: string, current: boolean) {
    setTogglingUid(uid);
    try {
      const r = await fetch(`/api/admin/agents/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      if (r.ok) {
        setAgents(prev => prev.map(a => a.uid === uid ? { ...a, isActive: !current } : a));
      }
    } finally {
      setTogglingUid(null);
    }
  }

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const r = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, email: formEmail, password: formPassword, companyId: formCompanyId }),
      });
      const d = await r.json() as { success: boolean; uid: string; message: string } | { error: string; message: string };
      if (!r.ok || "error" in d) {
        setCreateError(("message" in d ? d.message : null) ?? "Failed to create agent.");
        return;
      }
      // Re-fetch agents list
      const listRes = await fetch("/api/admin/agents");
      const listData = await listRes.json() as { agents: AgentItem[] } | { error: string };
      if (!("error" in listData)) setAgents(listData.agents);
      setShowModal(false);
      setFormName(""); setFormEmail(""); setFormPassword(""); setFormCompanyId("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageShell
      title="Field Agent Management"
      description={`${agents.length} field agents across all companies`}
      actions={
        <Button size="sm" onClick={() => setShowModal(true)} className="bg-[#333a8b] hover:bg-[#2a2f6e] text-white">
          <Plus size={14} className="mr-1.5" />
          New Agent
        </Button>
      }
    >
      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search agents…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-36 rounded bg-gray-200 animate-pulse" />
                    <div className="h-3 w-48 rounded bg-gray-200 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-16 text-sm text-muted-foreground">
              {search ? "No agents match your search." : "No field agents yet."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Company</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(a => (
                  <tr key={a.uid} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 hidden md:table-cell">{a.companyName}</td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge
                        variant={a.isActive ? "secondary" : "destructive"}
                        className={a.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                      >
                        {a.isActive ? "Active" : "Revoked"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => void toggleAgent(a.uid, a.isActive)}
                        disabled={togglingUid === a.uid}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded transition-colors disabled:opacity-50 ${
                          a.isActive
                            ? "text-red-600 hover:bg-red-50"
                            : "text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {a.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                        {a.isActive ? "Revoke" : "Restore"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-base font-semibold text-gray-900">Create Field Agent</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Agent will receive a welcome email with login credentials.</p>
            </div>
            <form onSubmit={e => void createAgent(e)} className="px-6 py-4 space-y-4">
              {createError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                  {createError}
                </div>
              )}
              <div>
                <Label htmlFor="agent-name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="agent-name"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="agent-email" className="text-sm font-medium">Email</Label>
                <Input
                  id="agent-email"
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="jane@company.com"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="agent-password" className="text-sm font-medium">Initial Password</Label>
                <Input
                  id="agent-password"
                  type="password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  minLength={8}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="agent-company" className="text-sm font-medium">Company</Label>
                <select
                  id="agent-company"
                  value={formCompanyId}
                  onChange={e => setFormCompanyId(e.target.value)}
                  required
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#333a8b]"
                >
                  <option value="">Select a company…</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowModal(false); setCreateError(null); }}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#333a8b] hover:bg-[#2a2f6e] text-white"
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Create Agent"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}
