import { cn } from "@/lib/utils";

// Loading placeholder shown while a Recharts chunk is being fetched (the charts
// are lazy-loaded via next/dynamic). Pass a height class to match the chart.
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "w-full animate-pulse-soft rounded-lg bg-slate-100",
        className ?? "h-48",
      )}
    />
  );
}
