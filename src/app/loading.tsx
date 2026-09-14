export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <div className="h-8 w-48 animate-pulse-soft rounded-lg bg-slate-100" />
        <div className="h-4 w-64 animate-pulse-soft rounded-lg bg-slate-100" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse-soft rounded-lg bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
