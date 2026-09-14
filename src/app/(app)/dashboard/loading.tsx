import { Skeleton, SkeletonHeader } from "@/components/ui/Skeleton";

// Mirrors the dashboard layout: header, a wide featured team card with two
// smaller team cards under it, and the recent-matches column on the right.
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3">
        <SkeletonHeader />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <Skeleton className="h-64 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        </div>
        <div className="space-y-5 lg:col-span-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
