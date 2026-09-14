"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="stat-number text-7xl font-bold text-slate-300">500</div>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl mt-4 text-slate-900">
        Something went wrong.
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        The error has been logged. Try refreshing - if it keeps happening,
        the issue is on our side and we&apos;ll get to it.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[10px] text-slate-400">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/dashboard" className="btn-secondary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
