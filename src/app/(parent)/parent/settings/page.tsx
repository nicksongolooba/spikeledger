import { AlertTriangle } from "lucide-react";
import { requireParent } from "@/lib/session";
import { getParentPlayers } from "@/lib/parent";
import { LinkPlayerForm } from "@/components/parent/LinkPlayerForm";
import { UnlinkButton } from "@/components/parent/UnlinkButton";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ParentSettingsPage({
  searchParams,
}: {
  searchParams?: { codeError?: string };
}) {
  const user = await requireParent();
  const players = await getParentPlayers(user.id);

  return (
    <div>
      <header>
        <div className="eyebrow">Parent account</div>
        <h1 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
          Settings
        </h1>
        <p className="mt-3 text-slate-600">
          Signed in as <span className="font-semibold text-slate-900">{user.email}</span>.
          Parent accounts are free.
        </p>
      </header>

      {searchParams?.codeError === "1" && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Your account was created, but the code you entered didn&apos;t match a
            player. Check it with the coach and try again below.
          </span>
        </div>
      )}

      <section className="card mt-8">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="font-display text-lg font-bold text-slate-900">Players you follow</h2>
        </div>
        {players.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No players linked yet. Enter a code below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {players.map((p) => (
              <li key={p.linkId} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="stat-number flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100 text-base font-bold text-slate-900">
                  {p.player.number ?? "-"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{p.player.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {p.team.name} · linked {formatDate(p.linkedAt)}
                    {!p.player.isActive ? " · no longer on the roster" : ""}
                  </div>
                </div>
                <UnlinkButton linkId={p.linkId} playerName={p.player.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <LinkPlayerForm />
      </div>
    </div>
  );
}
