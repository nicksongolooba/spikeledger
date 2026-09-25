import Link from "next/link";
import { ArrowRight, CreditCard, User } from "lucide-react";
import { requireCoach } from "@/lib/session";
import { PLAN_LABEL } from "@/lib/plan-limits";

export default async function SettingsPage() {
  const user = await requireCoach();
  return (
    <div>
      <header>
        <div className="eyebrow">Settings</div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Your account
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">
          Who you are on SpikeLedger, and the plan you are on.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-12">
        <section className="card p-6 lg:col-span-7">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-800"
              aria-hidden
            >
              <User size={18} strokeWidth={2} />
            </span>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Account
            </h2>
          </div>
          <dl className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
            <div className="grid gap-1 py-3 sm:grid-cols-3">
              <dt className="text-sm text-slate-500">Name</dt>
              <dd className="text-sm font-medium text-slate-900 sm:col-span-2">
                {user.name ?? "-"}
              </dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-3">
              <dt className="text-sm text-slate-500">Email</dt>
              <dd className="truncate text-sm font-medium text-slate-900 sm:col-span-2">
                {user.email}
              </dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-3">
              <dt className="text-sm text-slate-500">Plan</dt>
              <dd className="sm:col-span-2">
                <span className="inline-flex items-center rounded border border-navy-200 bg-navy-50 px-1.5 py-0.5 text-xs font-semibold text-navy-800">
                  {PLAN_LABEL[user.plan]}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <Link
          href="/settings/billing"
          className="card card-hover group flex flex-col p-6 lg:col-span-5"
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-white"
              aria-hidden
            >
              <CreditCard size={18} strokeWidth={2} />
            </span>
            <ArrowRight
              size={18}
              strokeWidth={2}
              className="shrink-0 text-slate-300 transition-colors group-hover:text-cyan-600"
              aria-hidden
            />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900 group-hover:text-cyan-700">
            Billing and plan
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            See what you have used, change plans, or update your card.
          </p>
        </Link>
      </div>
    </div>
  );
}
