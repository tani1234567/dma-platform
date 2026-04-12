"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAssessment, createAssessmentForYear } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const FINANCIAL_YEARS = ["2022-23", "2023-24", "2024-25", "2025-26", "2026-27"];

export default function NewAssessmentPage() {
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();
  const [fyYear, setFyYear] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [duplicateFy, setDuplicateFy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fyYear || !firebaseUser?.uid) return;

    setSubmitting(true);
    setDuplicateFy(null);
    setError(null);

    try {
      const companyId = firebaseUser.uid;
      const existing = await getAssessment(companyId, fyYear);
      if (existing) {
        setDuplicateFy(fyYear);
        setSubmitting(false);
        return;
      }
      await createAssessmentForYear(companyId, fyYear, firebaseUser.uid);
      router.push(`/dashboard/assessment/${fyYear}/topics`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Page heading */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard"
          className="text-[#6b7280] hover:text-[#333a8b] transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">New Assessment</h1>
      </div>

      {/* Card */}
      <div className="max-w-lg">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              Select Financial Year
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Each financial year has its own independent assessment cycle.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="fy-select">Financial Year</Label>
                <select
                  id="fy-select"
                  value={fyYear}
                  onChange={(e) => {
                    setFyYear(e.target.value);
                    setDuplicateFy(null);
                    setError(null);
                  }}
                  className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#333a8b] focus:border-transparent"
                  required
                >
                  <option value="" disabled>
                    Select a year…
                  </option>
                  {FINANCIAL_YEARS.map((fy) => (
                    <option key={fy} value={fy}>
                      FY {fy}
                    </option>
                  ))}
                </select>
              </div>

              {duplicateFy && (
                <p className="text-sm text-red-600">
                  An assessment for {duplicateFy} already exists.{" "}
                  <Link
                    href={`/dashboard/assessment/${duplicateFy}/topics`}
                    className="font-medium underline hover:text-red-700"
                  >
                    View it →
                  </Link>
                </p>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="submit"
                disabled={submitting || !fyYear}
                className="w-full bg-[#ff6900] hover:bg-[#e85f00] text-white rounded-lg"
              >
                {submitting ? "Creating…" : "Create Assessment"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
