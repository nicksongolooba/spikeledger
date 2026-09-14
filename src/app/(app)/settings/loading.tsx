import { Skeleton, SkeletonHeader } from "@/components/ui/Skeleton";

// Covers /settings and /settings/billing.
export default function Loading() {
  return (
    <div className="space-y-8">
      <SkeletonHeader />
      <div className="grid gap-5 lg:grid-cols-12">
        <Skeleton className="h-48 lg:col-span-7" />
        <Skeleton className="h-48 lg:col-span-5" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
