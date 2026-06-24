import { SkeletonHeader, SkeletonCards } from "@/components/ui/Skeleton";

// Default fallback for any (app) route that doesn't define its own loading.tsx.
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonCards count={6} />
    </div>
  );
}
