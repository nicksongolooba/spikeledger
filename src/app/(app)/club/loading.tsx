import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

// Covers /club and /club/setup.
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonTable rows={5} />
    </div>
  );
}
