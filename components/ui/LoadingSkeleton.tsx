import { cn } from "@/lib/utils";

type SkeletonVariant = "card" | "table-row" | "text-line";

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
  className?: string;
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-white p-5 space-y-3 animate-pulse", className)}>
      <div className="h-3 w-28 rounded bg-gray-200" />
      <div className="h-7 w-16 rounded bg-gray-200" />
    </div>
  );
}

function SkeletonTableRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 px-5 py-4 border-b border-border animate-pulse", className)}>
      <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-40 rounded bg-gray-200" />
        <div className="h-3 w-24 rounded bg-gray-200" />
      </div>
      <div className="h-3 w-16 rounded bg-gray-200 shrink-0" />
    </div>
  );
}

function SkeletonTextLine({ className }: { className?: string }) {
  return (
    <div className={cn("h-3.5 rounded bg-gray-200 animate-pulse", className ?? "w-full")} />
  );
}

export function LoadingSkeleton({
  variant = "card",
  count = 1,
  className,
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count });

  if (variant === "card") {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {items.map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (variant === "table-row") {
    return (
      <div className={cn("rounded-lg border border-border bg-white overflow-hidden", className)}>
        {items.map((_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </div>
    );
  }

  // text-line
  return (
    <div className={cn("space-y-2", className)}>
      {items.map((_, i) => (
        <SkeletonTextLine key={i} />
      ))}
    </div>
  );
}
