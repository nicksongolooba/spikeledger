"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="card p-7">
      <div className="h-7 w-40 animate-pulse-soft rounded bg-slate-100" />
      <div className="mt-2 h-4 w-64 animate-pulse-soft rounded bg-slate-100" />
      <div className="mt-6 space-y-4">
        <div className="h-10 animate-pulse-soft rounded bg-slate-100" />
        <div className="h-10 animate-pulse-soft rounded bg-slate-100" />
        <div className="h-10 animate-pulse-soft rounded bg-slate-100" />
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (!res || res.error) {
      setError("Email or password is incorrect.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="card p-7">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-600">Log in to your SpikeLedger account.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="coach@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? "Logging in…" : "Log in"}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowReset((v) => !v)}
            className="text-xs text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Forgot password?
          </button>
          {showReset && (
            <p className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
              Email{" "}
              <a
                href="mailto:support@spikeledger.com"
                className="font-semibold text-cyan-700 hover:text-cyan-800"
              >
                support@spikeledger.com
              </a>{" "}
              to reset your password.
            </p>
          )}
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-cyan-700 hover:text-cyan-800">
          Create one
        </Link>
      </p>
    </div>
  );
}
