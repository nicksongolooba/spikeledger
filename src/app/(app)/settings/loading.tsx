import { Skeleton, SkeletonHeader } from "@/components/ui/Skeleton";

// Covers /settings and /settings/billing.
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  );
}
