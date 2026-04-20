"use client";

import { useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { Check, X, Pencil, MessageSquareText } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface TopicItem {
  id: string;
  code: string;
  name: string;
  pillarCode: string;
  griReference: string;
  description: string;
  questionsCount: number;
  isActive: boolean;
}

const PILLAR_COLORS: Record<string, string> = {
  E: "bg-green-100 text-green-700",
  S: "bg-blue-100 text-blue-700",
  G: "bg-purple-100 text-purple-700",
};

export default function AdminTopicsPage() {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editGriRef, setEditGriRef] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/topics")
      .then(r => r.json())
      .then((d: { topics: TopicItem[] } | { error: string }) => {
        if ("error" in d) return;
        setTopics(d.topics);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(code: string, current: boolean) {
    setTogglingCode(code);
    try {
      const r = await fetch(`/api/admin/topics/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      if (r.ok) {
        setTopics(prev => prev.map(t => t.code === code ? { ...t, isActive: !current } : t));
      }
    } finally {
      setTogglingCode(null);
    }
  }

  function startEdit(topic: TopicItem) {
    setEditingCode(topic.code);
    setEditDescription(topic.description);
    setEditGriRef(topic.griReference === "—" ? "" : topic.griReference);
  }

  async function saveEdit(code: string) {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/topics/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription, griReference: editGriRef }),
      });
      if (r.ok) {
        setTopics(prev => prev.map(t =>
          t.code === code
            ? { ...t, description: editDescription, griReference: editGriRef || "—" }
            : t
        ));
        setEditingCode(null);
      }
    } finally {
      setSaving(false);
    }
  }

  const activePillar = (p: string) => topics.filter(t => t.pillarCode === p && t.isActive).length;
  const totalActive = topics.filter(t => t.isActive).length;

  return (
    <PageShell
      title="GRI Topic Bank"
      description={`${totalActive} of ${topics.length} topics active — E: ${activePillar("E")} · S: ${activePillar("S")} · G: ${activePillar("G")}`}
    >
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-6 w-10 rounded bg-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-48 rounded bg-gray-200 animate-pulse" />
                    <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : topics.length === 0 ? (
            <p className="text-center py-16 text-sm text-muted-foreground">No GRI topics found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Topic</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">GRI Ref</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Questions</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Questions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topics.map(t => (
                  <Fragment key={t.code}>
                    <tr className={`hover:bg-gray-50 ${!t.isActive ? "opacity-60" : ""}`}>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PILLAR_COLORS[t.pillarCode] ?? "bg-gray-100 text-gray-600"}`}>
                          {t.code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{t.description || "—"}</p>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 hidden lg:table-cell text-xs">{t.griReference}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 font-medium">{t.questionsCount}</td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => void toggleActive(t.code, t.isActive)}
                          disabled={togglingCode === t.code}
                          aria-label={t.isActive ? "Deactivate topic" : "Activate topic"}
                          className={`inline-flex items-center justify-center w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${
                            t.isActive ? "bg-[#333a8b]" : "bg-gray-300"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${t.isActive ? "translate-x-2" : "-translate-x-2"}`} />
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {editingCode === t.code ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => void saveEdit(t.code)}
                              disabled={saving}
                              className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-50"
                              aria-label="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingCode(null)}
                              className="p-1 rounded text-red-500 hover:bg-red-50"
                              aria-label="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(t)}
                            className="p-1.5 rounded text-muted-foreground hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            aria-label="Edit topic"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Link
                          href={`/admin/topics/${t.code}/questions`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#333a8b] bg-[#eff2ff] hover:bg-[#dde3ff] transition-colors"
                          title={`Manage questions for ${t.code}`}
                        >
                          <MessageSquareText size={11} />
                          {t.questionsCount}
                        </Link>
                      </td>
                    </tr>
                    {editingCode === t.code && (
                      <tr className="bg-[#eff2ff]/50">
                        <td colSpan={7} className="px-5 py-3">
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                              <label className="text-xs font-medium text-muted-foreground block mb-1">GRI Reference</label>
                              <Input
                                value={editGriRef}
                                onChange={e => setEditGriRef(e.target.value)}
                                placeholder="e.g. GRI 305"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex-[2]">
                              <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
                              <Input
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                placeholder="Topic description…"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
