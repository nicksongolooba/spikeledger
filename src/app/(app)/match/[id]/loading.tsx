import {
  Skeleton,
  SkeletonHeader,
  SkeletonStatTiles,
  SkeletonTable,
} from "@/components/ui/Skeleton";

// Covers /match/[id]/entry (courtside) and /match/[id]/review.
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <Skeleton className="h-28 rounded-xl" />
      <SkeletonStatTiles count={5} />
      <SkeletonTable rows={6} />
    </div>
  );
}
