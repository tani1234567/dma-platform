"use client";

import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AgentPage() {
  const { userDoc, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <PageShell
      title={`Hello, ${userDoc?.displayName ?? "Agent"}!`}
      description="Your assigned survey tasks"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Surveys</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#ff6900]">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#333a8b]">0</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center py-8 text-muted-foreground text-sm">
              No tasks assigned yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
