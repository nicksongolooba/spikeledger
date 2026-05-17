// Shimmer skeleton used while AI insights are being fetched. Keeps the page
// from jumping when the panel appears.

export function InsightSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-violet-400/5 to-transparent animate-[shimmer_2.4s_infinite]" />
      <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
      <div className="flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4 animate-pulse text-violet-300"
        >
          <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
        </svg>
        <span className="text-xs uppercase tracking-wide text-slate-400">
          Generating insights…
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse-soft rounded bg-slate-800"
            style={{ width: `${85 - i * 7}%` }}
          />
        ))}
      </div>
    </div>
  );
}
