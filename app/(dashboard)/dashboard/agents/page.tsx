"use client";

import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  UserX,
  UserCheck,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AgentItem {
  uid: string;
  name: string;
  email: string;
  isActive: boolean;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function CompanyAgentsPage() {
  const [agents, setAgents]         = useState<AgentItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);
  const [showModal, setShowModal]   = useState(false);
  const hasFetched = useRef(false);

  // Form state
  const [formName, setFormName]         = useState("");
  const [formEmail, setFormEmail]       = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState<string | null>(null);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadAgents();
  }, []);

  function loadAgents() {
    setLoading(true);
    void fetch("/api/company/agents")
      .then(async (r) => {
        const d = await r.json() as { agents: AgentItem[] } | { error: string };
        if ("error" in d) { setError("Failed to load agents."); return; }
        setAgents(d.agents);
      })
      .catch(() => setError("Failed to load agents."))
      .finally(() => setLoading(false));
  }

  async function toggleAgent(uid: string, current: boolean) {
    setTogglingUid(uid);
    try {
      const r = await fetch(`/api/company/agents/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      const d = await r.json() as { success: boolean } | { error: string; message: string };
      if (r.ok && "success" in d) {
        setAgents((prev) => prev.map((a) => a.uid === uid ? { ...a, isActive: !current } : a));
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
      const r = await fetch("/api/company/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, email: formEmail, password: formPassword }),
      });
      const d = await r.json() as { success: boolean; uid: string } | { error: string; message: string };
      if (!r.ok || "error" in d) {
        setCreateError(("message" in d ? d.message : null) ?? "Failed to create agent.");
        return;
      }
      setShowModal(false);
      setFormName(""); setFormEmail(""); setFormPassword("");
      loadAgents();
    } finally {
      setCreating(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setCreateError(null);
    setFormName(""); setFormEmail(""); setFormPassword("");
  }

  const activeCount = agents.filter((a) => a.isActive).length;

  return (
    <PageShell
      title="Field Agents"
      description="Manage agents who submit surveys on behalf of your stakeholders"
      actions={
        <Button
          size="sm"
          onClick={() => setShowModal(true)}
          className="bg-[#333a8b] hover:bg-[#2a3070] text-white"
        >
          <Plus size={14} className="mr-1.5" />
          Add Agent
        </Button>
      }
    >
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4 text-sm text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Summary cards */}
      {!loading && agents.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-center gap-3">
            <div className="bg-[#eff2ff] rounded-full p-2 shrink-0">
              <Briefcase size={16} className="text-[#333a8b]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                Total Agents
              </p>
              <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-center gap-3">
            <div className="bg-green-50 rounded-full p-2 shrink-0">
              <CheckCircle2 size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                Active
              </p>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
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
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-8">
              <Briefcase size={32} className="text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">No agents yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Add a field agent to let them submit surveys on behalf of your stakeholders.
              </p>
              <Button
                size="sm"
                onClick={() => setShowModal(true)}
                className="bg-[#333a8b] hover:bg-[#2a3070] text-white mt-1"
              >
                <Plus size={13} className="mr-1.5" />
                Add First Agent
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Agent
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
                {agents.map((a) => (
                  <tr key={a.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#eff2ff] flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[#333a8b]">{initials(a.name)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {a.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <XCircle size={10} />
                          Suspended
                        </span>
                      )}
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
                        {togglingUid === a.uid ? (
                          "Updating…"
                        ) : a.isActive ? (
                          <><UserX size={13} /> Suspend</>
                        ) : (
                          <><UserCheck size={13} /> Restore</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Add Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-base font-semibold text-gray-900">Add Field Agent</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                The agent will receive a welcome email with their login credentials.
              </p>
            </div>
            <form onSubmit={(e) => void createAgent(e)} className="px-6 py-4 space-y-4">
              {createError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                  {createError}
                </div>
              )}
              <div>
                <Label htmlFor="fa-name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="fa-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fa-email" className="text-sm font-medium">Email</Label>
                <Input
                  id="fa-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fa-password" className="text-sm font-medium">Initial Password</Label>
                <Input
                  id="fa-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  minLength={8}
                  required
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={closeModal}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#333a8b] hover:bg-[#2a3070] text-white"
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
