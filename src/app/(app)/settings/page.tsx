import Link from "next/link";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-slate-400">Manage your account and plan.</p>

      <div className="mt-6 card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Account
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Name</dt>
            <dd className="text-sm text-slate-100">{user.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="text-sm text-slate-100">{user.email}</dd>
          </div>
        </dl>
      </div>

      <Link
        href="/settings/billing"
        className="mt-4 flex items-center justify-between card p-6 transition-colors hover:border-slate-700"
      >
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Billing &amp; Plan
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            View your plan, manage your subscription, and update payment.
          </p>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5 shrink-0 text-slate-500"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>
    </div>
  );
}
