import { Skeleton, SkeletonHeader, SkeletonCards } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3">
        <SkeletonHeader />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <SkeletonCards count={6} />
    </div>
  );
}
