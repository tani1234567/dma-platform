"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import {
  getAssessment,
  onStakeholders,
  addStakeholderDoc,
  updateStakeholderDoc,
  deleteStakeholderDoc,
  batchAddStakeholderDocs,
  changeAssessmentStakeholderCount,
  updateAssessment,
} from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Assessment, Stakeholder, StakeholderType, SurveyTokenStatus } from "@/types";
import { TOPIC_SUGGESTIONS_BY_TYPE } from "@/lib/topicSuggestions";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAKEHOLDER_TYPES = Object.values(StakeholderType);

const DEFAULT_WEIGHTS: Record<string, number> = {
  Management: 0.25,
  Employees: 0.15,
  Customers: 0.15,
  Suppliers: 0.10,
  Community: 0.10,
  Investors: 0.15,
  "Experts/NGOs": 0.10,
};

const TYPE_COLORS: Record<string, string> = {
  Management: "#333a8b",
  Employees: "#4f46e5",
  Customers: "#0ea5e9",
  Suppliers: "#10b981",
  Community: "#f59e0b",
  Investors: "#ef4444",
  "Experts/NGOs": "#8b5cf6",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRY_MS = 45 * 24 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

interface ParsedRow {
  row: number;
  name: string;
  email: string;
  type: string;
  valid: boolean;
  errors: string[];
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line, i) => {
    const [name = "", email = "", type = ""] = parseCSVLine(line);
    const errors: string[] = [];
    if (!name) errors.push("Name required");
    if (!EMAIL_RE.test(email)) errors.push("Invalid email");
    if (!STAKEHOLDER_TYPES.includes(type as StakeholderType)) errors.push("Invalid type");
    return { row: i + 2, name, email, type, valid: errors.length === 0, errors };
  });
}

function makeStakeholderData(
  name: string,
  email: string,
  type: StakeholderType,
  companyId: string,
  assessmentId: string,
  weights: Record<string, number>,
  selectedTopics: string[]
): Omit<Stakeholder, "id" | "createdAt" | "updatedAt"> {
  const suggestions = TOPIC_SUGGESTIONS_BY_TYPE[type] ?? [];
  const assignedTopics = suggestions.filter((code) => selectedTopics.includes(code));
  return {
    companyId,
    assessmentId,
    name,
    email,
    type,
    weight: weights[type] ?? DEFAULT_WEIGHTS[type] ?? 0,
    surveyToken: crypto.randomUUID(),
    tokenExpiresAt: Timestamp.fromMillis(Date.now() + EXPIRY_MS),
    status: SurveyTokenStatus.PENDING,
    reminderCount: 0,
    isProxySubmission: false,
    assignedTopics,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-20 right-6 z-50 animate-fade-in bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg pointer-events-none">
      {message}
    </div>
  );
}

function StatusBadge({ status }: { status: SurveyTokenStatus }) {
  const map: Record<SurveyTokenStatus, { label: string; bg: string; color: string }> = {
    [SurveyTokenStatus.PENDING]:   { label: "Pending",   bg: "#f3f4f6", color: "#6b7280" },
    [SurveyTokenStatus.SENT]:      { label: "Sent",      bg: "#dbeafe", color: "#1e40af" },
    [SurveyTokenStatus.OPENED]:    { label: "Opened",    bg: "#dbeafe", color: "#1e40af" },
    [SurveyTokenStatus.COMPLETED]: { label: "Submitted", bg: "#dcfce7", color: "#166534" },
    [SurveyTokenStatus.EXPIRED]:   { label: "Expired",   bg: "#fee2e2", color: "#991b1b" },
  };
  const s = map[status] ?? map[SurveyTokenStatus.PENDING];
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StakeholdersPage() {
  const { fyId } = useParams<{ fyId: string }>();
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({ ...DEFAULT_WEIGHTS });

  // Add-form state
  const [form, setForm] = useState({ name: "", email: "", type: "" });
  const [formErrors, setFormErrors] = useState<Partial<Record<"name" | "email" | "type", string>>>({});
  const [adding, setAdding] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", type: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // CSV state
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Weight config state
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const companyId = firebaseUser?.uid ?? "";

  // Load assessment for initial weights
  useEffect(() => {
    if (authLoading || !companyId) return;
    getAssessment(companyId, fyId).then((a) => {
      setAssessment(a);
      if (a?.stakeholderWeightages) {
        setWeights({ ...DEFAULT_WEIGHTS, ...a.stakeholderWeightages });
      }
    }).catch(() => {});
  }, [authLoading, companyId, fyId]);

  // Real-time stakeholder subscription
  useEffect(() => {
    if (authLoading || !companyId) return;
    return onStakeholders(companyId, fyId, setStakeholders);
  }, [authLoading, companyId, fyId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Add stakeholder ───────────────────────────────────────────────────────

  function validateForm(): boolean {
    const errs: Partial<Record<"name" | "email" | "type", string>> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!EMAIL_RE.test(form.email)) errs.email = "Enter a valid email";
    if (!form.type) errs.type = "Select a type";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm() || !companyId) return;
    setAdding(true);
    try {
      const data = makeStakeholderData(
        form.name.trim(),
        form.email.trim(),
        form.type as StakeholderType,
        companyId,
        fyId,
        weights,
        assessment?.selectedTopics ?? []
      );
      await addStakeholderDoc(companyId, fyId, data.surveyToken, data);
      await changeAssessmentStakeholderCount(companyId, fyId, 1);
      setForm({ name: "", email: "", type: "" });
      setFormErrors({});
      setToast("Stakeholder added");
    } catch {
      setToast("Failed to add stakeholder");
    } finally {
      setAdding(false);
    }
  }

  // ── Edit stakeholder ─────────────────────────────────────────────────────

  function startEdit(s: Stakeholder) {
    setEditingId(s.id);
    setEditForm({ name: s.name, email: s.email, type: s.type });
  }

  async function handleSaveEdit(id: string) {
    if (!companyId) return;
    setSavingEdit(true);
    try {
      await updateStakeholderDoc(companyId, fyId, id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        type: editForm.type as StakeholderType,
        weight: weights[editForm.type] ?? DEFAULT_WEIGHTS[editForm.type] ?? 0,
      });
      setEditingId(null);
      setToast("Stakeholder updated");
    } catch {
      setToast("Failed to update");
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Delete stakeholder ───────────────────────────────────────────────────

  async function handleDelete(id: string, alreadyInvited = false) {
    if (!companyId) return;
    if (
      alreadyInvited &&
      !window.confirm(
        "This stakeholder has already received a survey invite. Removing them will not recall the email. Continue?"
      )
    ) {
      return;
    }
    try {
      await deleteStakeholderDoc(companyId, fyId, id);
      await changeAssessmentStakeholderCount(companyId, fyId, -1);
      setToast("Stakeholder removed");
    } catch {
      setToast("Failed to remove");
    }
  }

  // ── CSV import ───────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvRows(parseCSV(ev.target?.result as string));
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv = ["Name,Email,Type", ...STAKEHOLDER_TYPES.map((t) => `Example Name,example@email.com,${t}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stakeholders_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBatchImport() {
    if (!companyId) return;
    const valid = csvRows.filter((r) => r.valid);
    if (!valid.length) return;
    setImporting(true);
    try {
      const items = valid.map((r) => {
        const data = makeStakeholderData(
          r.name, r.email, r.type as StakeholderType, companyId, fyId, weights,
          assessment?.selectedTopics ?? []
        );
        return { token: data.surveyToken, data };
      });
      await batchAddStakeholderDocs(companyId, fyId, items);
      await changeAssessmentStakeholderCount(companyId, fyId, items.length);
      setCsvRows([]);
      if (fileRef.current) fileRef.current.value = "";
      setToast(`${items.length} stakeholder${items.length !== 1 ? "s" : ""} imported`);
    } catch {
      setToast("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  // ── Weights ──────────────────────────────────────────────────────────────

  function handleWeightChange(type: string, value: string) {
    const num = parseFloat(value);
    setWeights((prev) => ({ ...prev, [type]: isNaN(num) ? 0 : Math.min(1, Math.max(0, num)) }));
  }

  async function handleSaveWeights() {
    if (!companyId) return;
    setSavingWeights(true);
    try {
      await updateAssessment(companyId, fyId, { stakeholderWeightages: weights });
      setToast("Weightages saved");
    } catch {
      setToast("Failed to save weightages");
    } finally {
      setSavingWeights(false);
    }
  }

  const weightSum = Object.values(weights).reduce((s, v) => s + v, 0);
  const weightSumOk = Math.abs(weightSum - 1) < 0.001;

  const chartData = Object.entries(weights).map(([name, value]) => ({
    name,
    value,
    color: TYPE_COLORS[name] ?? "#94a3b8",
  }));

  const validCSVCount = csvRows.filter((r) => r.valid).length;
  const totalCount = stakeholders.length;

  // ── Render ───────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <>
      {toast && <Toast message={toast} />}

      <div className="p-8 pb-28 space-y-8">

        {/* ── Section 1: Add Stakeholder ────────────────────────────────── */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Add Stakeholder</h2>
          <form onSubmit={handleAdd} noValidate>
            <div className="flex flex-wrap gap-3 items-end">
              {/* Name */}
              <div className="flex flex-col gap-1 min-w-[180px] flex-1">
                <Label htmlFor="s-name">Name</Label>
                <Input
                  id="s-name"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={formErrors.name ? "border-red-400" : ""}
                />
                {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1 min-w-[200px] flex-1">
                <Label htmlFor="s-email">Email</Label>
                <Input
                  id="s-email"
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className={formErrors.email ? "border-red-400" : ""}
                />
                {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
              </div>

              {/* Type + weight */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-type">Type</Label>
                <div className="flex items-center gap-2">
                  <select
                    id="s-type"
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className={cn(
                      "h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#333a8b]",
                      formErrors.type ? "border-red-400" : ""
                    )}
                  >
                    <option value="" disabled>Select type…</option>
                    {STAKEHOLDER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {form.type && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      w: {(weights[form.type] ?? DEFAULT_WEIGHTS[form.type] ?? 0).toFixed(2)}
                    </span>
                  )}
                </div>
                {formErrors.type && <p className="text-xs text-red-500">{formErrors.type}</p>}
              </div>

              <Button type="submit" disabled={adding} className="h-9 shrink-0">
                {adding ? "Adding…" : "Add Stakeholder"}
              </Button>
            </div>
          </form>
        </div>

        {/* ── Section 2: Stakeholder Table ──────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">
              Stakeholders
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {totalCount} stakeholder{totalCount !== 1 ? "s" : ""}
              </span>
            </h2>
          </div>

          {totalCount === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No stakeholders added yet. Add your first stakeholder above.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    {["Name", "Email", "Type", "Weight", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stakeholders.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      {editingId === s.id ? (
                        <>
                          <td className="px-4 py-2">
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={editForm.type}
                              onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))}
                              className="h-7 rounded-md border border-input bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#333a8b]"
                            >
                              {STAKEHOLDER_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-xs">
                            {(weights[editForm.type] ?? DEFAULT_WEIGHTS[editForm.type] ?? 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveEdit(s.id)} disabled={savingEdit} className="h-7 text-xs px-2">
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs px-2">
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                          <td className="px-4 py-3 text-gray-600">{s.email}</td>
                          <td className="px-4 py-3 text-gray-700">{s.type}</td>
                          <td className="px-4 py-3 text-gray-700">{s.weight.toFixed(2)}</td>
                          <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-3">
                            {s.status === SurveyTokenStatus.PENDING && (
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => startEdit(s)}
                                  className="text-gray-400 hover:text-[#333a8b] transition-colors"
                                  title="Edit stakeholder"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => void handleDelete(s.id, false)}
                                  className="text-gray-400 hover:text-red-600 transition-colors"
                                  title="Remove stakeholder"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                            {(s.status === SurveyTokenStatus.SENT ||
                              s.status === SurveyTokenStatus.OPENED ||
                              s.status === SurveyTokenStatus.EXPIRED) && (
                              <button
                                onClick={() => void handleDelete(s.id, true)}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove stakeholder (invite already sent)"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            {s.status === SurveyTokenStatus.COMPLETED && (
                              <span className="text-xs text-muted-foreground italic">
                                Submitted
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Section 3: CSV Bulk Import ────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setCsvOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Bulk Import via CSV
            {csvOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {csvOpen && (
            <div className="border-t border-border px-5 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  Download Template
                </Button>
                <span className="text-xs text-muted-foreground">
                  CSV format: Name, Email, Type
                </span>
              </div>

              <div>
                <Label htmlFor="csv-file" className="mb-1.5 block">Upload CSV</Label>
                <input
                  id="csv-file"
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
                />
              </div>

              {csvRows.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Preview — {validCSVCount} valid, {csvRows.length - validCSVCount} invalid
                  </p>
                  <div className="rounded-lg border border-border overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {["Row", "Name", "Email", "Type", "Status"].map((h) => (
                            <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {csvRows.map((r) => (
                          <tr key={r.row} className={r.valid ? "" : "bg-red-50"}>
                            <td className="px-3 py-2 text-gray-500">{r.row}</td>
                            <td className="px-3 py-2">{r.name || "—"}</td>
                            <td className="px-3 py-2">{r.email || "—"}</td>
                            <td className="px-3 py-2">{r.type || "—"}</td>
                            <td className="px-3 py-2">
                              {r.valid ? (
                                <span className="text-green-600 font-medium">✓ Valid</span>
                              ) : (
                                <span className="text-red-600" title={r.errors.join(", ")}>
                                  ✗ {r.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Button
                    variant="orange"
                    size="sm"
                    className="mt-3"
                    onClick={handleBatchImport}
                    disabled={importing || validCSVCount === 0}
                  >
                    {importing ? "Importing…" : `Import ${validCSVCount} valid row${validCSVCount !== 1 ? "s" : ""}`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 4: Weight Configuration ──────────────────────────── */}
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setWeightsOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Stakeholder Weightage Configuration
            {weightsOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {weightsOpen && (
            <div className="border-t border-border px-5 py-5">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Table */}
                <div className="flex-1">
                  <table className="w-full text-sm mb-4">
                    <thead>
                      <tr>
                        <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {STAKEHOLDER_TYPES.map((type) => (
                        <tr key={type}>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: TYPE_COLORS[type] ?? "#94a3b8" }}
                              />
                              {type}
                            </div>
                          </td>
                          <td className="py-2.5">
                            <Input
                              type="number"
                              min="0"
                              max="1"
                              step="0.01"
                              value={weights[type] ?? 0}
                              onChange={(e) => handleWeightChange(type, e.target.value)}
                              className="h-8 w-24 text-xs"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Sum */}
                  <p className={cn("text-sm font-semibold mb-4", weightSumOk ? "text-green-600" : "text-red-600")}>
                    Total: {weightSum.toFixed(2)} {weightSumOk ? "✓" : "— must equal 1.00"}
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
                    >
                      Reset to Defaults
                    </Button>
                    <Button
                      variant="orange"
                      size="sm"
                      onClick={handleSaveWeights}
                      disabled={savingWeights || !weightSumOk}
                    >
                      {savingWeights ? "Saving…" : "Save Weightages"}
                    </Button>
                  </div>
                </div>

                {/* Donut chart */}
                <div className="w-full lg:w-64 shrink-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Distribution
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          [`${(Number(value) * 100).toFixed(0)}%`, "Weight"]
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky bottom bar ─────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-[220px] right-0 z-40 bg-white border-t border-border shadow-lg px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-bold text-[#333a8b]">{totalCount}</span> stakeholder{totalCount !== 1 ? "s" : ""} added
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/assessment/${fyId}/topics`}>← Back to Topics</Link>
          </Button>
          <div title={totalCount === 0 ? "Add at least one stakeholder to continue" : undefined}>
            <Button
              variant="orange"
              disabled={totalCount === 0}
              onClick={() => router.push(`/dashboard/assessment/${fyId}/assign`)}
            >
              Continue to Topic Assignment →
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
