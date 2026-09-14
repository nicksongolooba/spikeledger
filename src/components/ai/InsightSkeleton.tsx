import { Lightbulb } from "lucide-react";

// Skeleton shown while insights are being fetched. Keeps the page from
// jumping when the panel appears.
export function InsightSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <Lightbulb size={16} strokeWidth={2} className="animate-pulse text-navy-700" aria-hidden />
        <span className="font-display text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Reading the numbers…
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse-soft rounded bg-slate-200"
            style={{ width: `${85 - i * 7}%` }}
          />
        ))}
      </div>
    </div>
  );
}
