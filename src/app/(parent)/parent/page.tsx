import Link from "next/link";
import { leadWithBalance } from "@/engine/bank-account";
import { ArrowRight, PauseCircle, UserX } from "lucide-react";
import { requireParent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getParentPlayers } from "@/lib/parent";
import { buildLiveSnapshot } from "@/lib/parent-view";
import { computeDerivedStats } from "@/engine/derived-stats";
import { LinkPlayerForm } from "@/components/parent/LinkPlayerForm";
import { MatchAlertsCard } from "@/components/parent/MatchAlertsCard";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ParentDashboard() {
  const user = await requireParent();
  const [players, prefs, activePush] = await Promise.all([
    getParentPlayers(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { installCardDismissedAt: true, emailMatchAlerts: true },
    }),
    prisma.pushSubscription.count({ where: { parentId: user.id, active: true } }),
  ]);

  const cards = await Promise.all(
    players.map(async (p) => {
      const viewable = p.player.isActive && p.team.allowParentView;
      if (!viewable)
        return {
          ...p,
          viewable,
          live: null,
          balance: null,
          deposits: null,
          withdrawals: null,
          ratingColor: null,
          ratingLabel: null,
        };
      const [live, lines] = await Promise.all([
        buildLiveSnapshot(p.player.id),
        prisma.statLine.findMany({ where: { playerId: p.player.id } }),
      ]);
      const hasStats = lines.some((l) => !l.didNotPlay);
      const season = hasStats
        ? computeDerivedStats(lines, "UTIL", p.team.usesPositions ? "positions" : "universal")
        : null;
      return {
        ...p,
        viewable,
        live,
        balance: season?.bankAccount.balance ?? null,
        deposits: season?.bankAccount.deposits ?? null,
        withdrawals: season?.bankAccount.withdrawals ?? null,
        ratingColor: season?.bankAccount.ratingColor ?? null,
        ratingLabel: season?.bankAccount.ratingLabel ?? null,
      };
    }),
  );
  const firstName = user.name?.split(" ")[0];

  return (
    <div>
      <header>
        <div className="eyebrow">Parent view</div>
        <h1 className="mt-1 font-display text-4xl font-bold leading-none tracking-tight text-slate-900 sm:text-5xl">
          {firstName ? `${firstName}'s players` : "My players"}
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Your own kid&apos;s numbers, updating live while they play, compared
          only to team averages. Tap a player to see the full picture.
        </p>
      </header>

      <MatchAlertsCard
        parentId={user.id}
        vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
        dismissed={Boolean(prefs?.installCardDismissedAt)}
        hasActivePush={activePush > 0}
        emailMatchAlerts={prefs?.emailMatchAlerts ?? true}
      />

      {cards.length === 0 ? (
        <div className="mt-8">
          <LinkPlayerForm />
        </div>
      ) : (
        <>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {cards.map((c) => {
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="stat-number flex h-12 w-12 shrink-0 items-center justify-center rounded bg-navy-900 text-xl font-bold text-white">
                        {c.player.number ?? "-"}
                      </span>
                      <div>
                        <div className="font-display text-2xl font-bold leading-none text-slate-900">
                          {c.player.name}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {c.team.name}
                          {c.team.ageGroup ? ` · ${c.team.ageGroup}` : ""}
                        </div>
                      </div>
                    </div>
                    {c.live?.status === "live" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-950 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-widest text-white">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                        </span>
                        Live
                      </span>
                    )}
                  </div>

                  {!c.viewable ? (
                    <div className="mt-4 flex items-start gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
                      {c.player.isActive ? (
                        <PauseCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
                      ) : (
                        <UserX size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
                      )}
                      <span>
                        {c.player.isActive
                          ? "The coach has paused the parent view for this team."
                          : "This player is no longer on the roster."}
                      </span>
                    </div>
                  ) : (
                    <dl className="mt-4 flex items-end justify-between gap-4">
                      <div>
                        <dt className="eyebrow text-slate-500">Season Bank Account</dt>
                        <dd className="mt-1 flex items-center gap-2">
                          {c.balance === null ? (
                            <span className="text-sm text-slate-500">No stats yet</span>
                          ) : leadWithBalance(c.balance) ? (
                            <>
                              <span className="stat-number text-3xl font-bold leading-none" style={{ color: c.ratingColor ?? undefined }}>
                                +{c.balance}
                              </span>
                              <span className="text-xs font-semibold text-slate-600">{c.ratingLabel}</span>
                            </>
                          ) : (
                            /* Never a minus sign as the headline on a child's
                               card: the two counts say the same thing. */
                            <>
                              <span className="stat-number text-2xl font-bold leading-none text-green-700">
                                {c.deposits}
                              </span>
                              <span className="text-xs text-slate-500">good plays</span>
                              <span className="stat-number text-2xl font-bold leading-none text-slate-700">
                                {c.withdrawals}
                              </span>
                              <span className="text-xs text-slate-500">errors</span>
                            </>
                          )}
                        </dd>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        {c.live?.match
                          ? c.live.status === "final"
                            ? `Last: ${c.live.match.result === "WIN" ? "W" : c.live.match.result === "LOSS" ? "L" : "-"} ${c.live.match.setsWon}-${c.live.match.setsLost} vs ${c.live.match.opponent}`
                            : `vs ${c.live.match.opponent}`
                          : "No matches yet"}
                      </div>
                    </dl>
                  )}
                </>
              );
              return (
                <li key={c.linkId}>
                  {c.viewable ? (
                    <Link
                      href={`/parent/player/${c.player.id}`}
                      className={cn("card card-hover block p-5", c.live?.status === "live" && "border-cyan-300")}
                    >
                      {inner}
                      <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700">
                        Open
                        <ArrowRight size={14} strokeWidth={2} aria-hidden />
                      </div>
                    </Link>
                  ) : (
                    <div className="card block p-5 opacity-80">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-8">
            <LinkPlayerForm />
          </div>
        </>
      )}
    </div>
  );
}
