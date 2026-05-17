import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-slate-400">
        Manage your account. Billing and team-share controls land in later phases.
      </p>

      <div className="mt-6 card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Account
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Name</dt>
            <dd className="text-sm text-slate-100">{user.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="text-sm text-slate-100">{user.email}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
