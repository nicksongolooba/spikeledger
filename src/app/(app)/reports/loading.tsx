import { Skeleton, SkeletonHeader } from "@/components/ui/Skeleton";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

// Covers /reports/generate/[teamId] and /reports/player/[pid].
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <Skeleton className="h-32 rounded-xl" />
      <ChartSkeleton className="h-56" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
