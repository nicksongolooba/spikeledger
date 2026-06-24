import {
  Skeleton,
  SkeletonHeader,
  SkeletonStatTiles,
  SkeletonTable,
} from "@/components/ui/Skeleton";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

// Covers /team/[id] and its nested routes (roster, import, tournament/*).
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SkeletonHeader />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <SkeletonStatTiles count={4} />
      <ChartSkeleton className="h-24" />
      <ChartSkeleton className="h-64" />
      <SkeletonTable rows={6} />
    </div>
  );
}
