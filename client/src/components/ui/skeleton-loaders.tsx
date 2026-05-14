/** Skeleton loading components with shimmer effect */
import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex gap-2">
        <Shimmer className="h-20 flex-1" />
        <Shimmer className="h-20 flex-1" />
        <Shimmer className="h-20 flex-1" />
      </div>
      <Shimmer className="h-48 w-full" />
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="px-4 pb-3">
      <Shimmer className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function BetCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card py-4">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted rounded-l-xl" />
      <div className="px-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-3.5 w-32" />
          </div>
          <div className="space-y-2 text-right">
            <Shimmer className="h-6 w-12 ml-auto" />
            <Shimmer className="h-3 w-8 ml-auto" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <Shimmer className="h-3 w-24" />
          <div className="flex gap-1">
            <Shimmer className="h-6 w-6 rounded-md" />
            <Shimmer className="h-6 w-6 rounded-md" />
            <Shimmer className="h-6 w-6 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BetFeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="px-4 space-y-3 py-4">
      <div className="flex justify-between items-center">
        <Shimmer className="h-3 w-16" />
        <div className="flex gap-2">
          <Shimmer className="h-7 w-24 rounded-md" />
          <Shimmer className="h-7 w-28 rounded-md" />
        </div>
      </div>
      <Shimmer className="h-8 w-full rounded-md" />
      {Array.from({ length: count }).map((_, i) => (
        <BetCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen pb-20 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shimmer className="h-5 w-20" />
          <Shimmer className="h-4 w-8 rounded" />
        </div>
        <div className="flex gap-1">
          <Shimmer className="h-8 w-8 rounded-md" />
          <Shimmer className="h-8 w-8 rounded-md" />
          <Shimmer className="h-8 w-8 rounded-md" />
          <Shimmer className="h-8 w-8 rounded-md" />
        </div>
      </div>
      <StatsSkeleton />
      <CalendarSkeleton />
      <BetFeedSkeleton count={3} />
    </div>
  );
}
