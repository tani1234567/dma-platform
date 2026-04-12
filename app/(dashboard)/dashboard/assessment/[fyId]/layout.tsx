"use client";

import { useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAssessment } from "@/lib/firebase/firestore";
import { Assessment, AssessmentStatus } from "@/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Topic Selection", path: "topics" },
  { label: "Stakeholders", path: "stakeholders" },
  { label: "Topic Assignment", path: "assign" },
  { label: "Launch", path: "launch" },
  { label: "Results", path: "results" },
];

function StatusBadge({ status }: { status: AssessmentStatus | undefined }) {
  if (status === AssessmentStatus.COMPLETED) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        Completed
      </span>
    );
  }
  if (!status || status === AssessmentStatus.DRAFT) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Draft
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      Active
    </span>
  );
}

export default function AssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { fyId } = useParams<{ fyId: string }>();
  const pathname = usePathname();
  const { firebaseUser } = useAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);

  useEffect(() => {
    if (!firebaseUser?.uid || !fyId) return;
    getAssessment(firebaseUser.uid, fyId).then(setAssessment).catch(() => {});
  }, [firebaseUser?.uid, fyId]);

  const currentPath = pathname.split("/").pop() ?? "";
  const activeIndex = STEPS.findIndex((s) => s.path === currentPath);
  const resolvedIndex = activeIndex === -1 ? 0 : activeIndex;

  const isDraft =
    !assessment || assessment.status === AssessmentStatus.DRAFT;

  return (
    <div>
      {/* Assessment header */}
      <div className="bg-white border-b border-border px-8 py-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
          <Link
            href="/dashboard"
            className="hover:text-[#333a8b] transition-colors"
          >
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">
            {fyId} Assessment
          </span>
        </nav>

        {/* Title row */}
        <div className="flex items-center gap-3 mb-6">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#eff2ff] text-[#333a8b]">
            FY {fyId}
          </span>
          <StatusBadge status={assessment?.status} />
        </div>

        {/* Step progress bar */}
        <div className="flex items-start">
          {STEPS.map((step, index) => {
            const isCompleted = index < resolvedIndex;
            const isCurrent = index === resolvedIndex;
            const isResultsLocked = step.path === "results" && isDraft;

            const circle = (
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                  isCompleted
                    ? "bg-[#333a8b] text-white"
                    : isCurrent
                    ? "bg-[#ff6900] text-white"
                    : "bg-gray-100 text-gray-400"
                )}
              >
                {isCompleted ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </div>
            );

            const label = (
              <span
                className={cn(
                  "text-xs mt-1.5 text-center w-20 leading-tight",
                  isCompleted
                    ? "text-[#333a8b] font-medium"
                    : isCurrent
                    ? "text-gray-900 font-semibold"
                    : "text-gray-400"
                )}
              >
                {step.label}
              </span>
            );

            const stepNode = isResultsLocked ? (
              <div className="flex flex-col items-center opacity-40 cursor-not-allowed select-none">
                {circle}
                {label}
              </div>
            ) : (
              <Link
                href={`/dashboard/assessment/${fyId}/${step.path}`}
                className="flex flex-col items-center group"
              >
                <div className="group-hover:opacity-80 transition-opacity">
                  {circle}
                </div>
                {label}
              </Link>
            );

            return (
              <Fragment key={step.path}>
                {stepNode}
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mt-3.5 mx-2",
                      index < resolvedIndex ? "bg-[#333a8b]" : "bg-gray-200"
                    )}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}
