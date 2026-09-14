import {
  Skeleton,
  SkeletonHeader,
  SkeletonStatTiles,
  SkeletonTable,
} from "@/components/ui/Skeleton";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

// Covers /team/[id] and its nested routes (roster, import, tournament/*).
// Mirrors the team page: header, four stat tiles and the wide trend card,
// then the tournaments list beside the roster grid.
export default function Loading() {
  return (
    <div>
      <Skeleton className="h-4 w-48" />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <SkeletonHeader />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>
      <div className="mt-10">
        <SkeletonStatTiles count={4} />
        <ChartSkeleton className="mt-4 h-40" />
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Skeleton className="mb-4 h-7 w-40" />
          <SkeletonTable rows={4} />
        </div>
        <div className="lg:col-span-5">
          <Skeleton className="mb-4 h-7 w-24" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
