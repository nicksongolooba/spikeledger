import { Skeleton, SkeletonHeader } from "@/components/ui/Skeleton";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

// Covers /reports/generate/[teamId] and /reports/player/[pid].
export default function Loading() {
  return (
    <div>
      <Skeleton className="h-4 w-48" />
      <div className="mt-4">
        <SkeletonHeader />
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-48 lg:col-span-5" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
      <ChartSkeleton className="mt-10 h-56" />
      <Skeleton className="mt-10 h-40" />
    </div>
  );
}
