import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="stat-number text-7xl font-bold text-slate-300">404</div>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl mt-4 text-slate-900">
        This page doesn&apos;t exist.
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        You might have hit a stale link, or the team you&apos;re looking for
        belongs to another coach.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/dashboard" className="btn-primary">
          Back to dashboard
        </Link>
        <Link href="/" className="btn-secondary">
          Landing
        </Link>
      </div>
    </div>
  );
}
