import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CirclePlay, Lightbulb } from "lucide-react";
import { requireParent } from "@/lib/session";
import { getPlayerForParent } from "@/lib/parent";
import { buildParentPlayerView } from "@/lib/parent-view";
import { fmtSigned } from "@/engine/derived-stats";
import { youtubeSearchUrl } from "@/lib/youtube";
import { LiveMatchCard } from "@/components/parent/LiveMatchCard";
import { ParentReportCards } from "@/components/parent/ParentReportCards";
import { PlayerTrendChart } from "@/components/charts/PlayerTrendChart";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ParentPlayerPage({ params }: { params: { playerId: string } }) {
  const user = await requireParent();
  const allowed = await getPlayerForParent(user.id, params.playerId);
  if (!allowed) notFound();
  const view = await buildParentPlayerView(allowed.id);
  if (!view) notFound();

  const { player, team, season, live } = view;

  return (
    <div>
      <Link
        href="/parent"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        My players
      </Link>

      <header className="mt-4 flex items-center gap-4">
        <span className="stat-number flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-2xl font-bold text-white">
          {player.number ?? "-"}
        </span>
        <div>
          <div className="eyebrow">{team.name}{team.ageGroup ? ` · ${team.ageGroup}` : ""}</div>
          <h1 className="mt-1 font-display text-4xl font-bold leading-none tracking-tight text-slate-900 sm:text-5xl">
            {player.name}
          </h1>
        </div>
      </header>

      <div className="mt-8">
        <LiveMatchCard playerId={player.id} playerName={player.name} initial={live} />
      </div>

      {!season ? (
        <section className="card mt-6 p-6">
          <p className="text-slate-600">
            {player.name} hasn&apos;t played a logged match yet. Season numbers,
            the Bank Account and report cards appear here after the first one.
          </p>
        </section>
      ) : (
        <>
          {/* Bank Account + team context */}
          <section className="mt-6 grid gap-5 lg:grid-cols-12">
            <div className="card p-5 lg:col-span-5">
              <div className="eyebrow text-slate-500">Season Bank Account</div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="stat-number text-6xl font-bold leading-none" style={{ color: season.bankAccount.ratingColor }}>
                  {fmtSigned(season.bankAccount.balance)}
                </span>
                <span
                  className="rounded px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-white"
                  style={{ background: season.bankAccount.ratingColor }}
                >
                  {season.bankAccount.ratingLabel}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {season.bankAccount.deposits} good plays against{" "}
                {season.bankAccount.withdrawals} errors across {season.matchesPlayed}{" "}
                {season.matchesPlayed === 1 ? "match" : "matches"}.{" "}
                {team.usesPositions
                  ? "Scored on what their position is asked to do, not on everyone else's stats."
                  : "Everyone on this team is scored on the same all-around formula."}
              </p>
            </div>

            <div className="card overflow-hidden lg:col-span-7">
              <div className="border-b border-slate-200 px-5 py-3.5">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {player.name} vs the team average
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Team numbers are averages across the whole roster. Individual teammates are never shown.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="eyebrow px-5 py-2 text-slate-500">Stat</th>
                    <th className="eyebrow px-3 py-2 text-right text-slate-500">Team avg</th>
                    <th className="eyebrow px-5 py-2 text-right text-orange-700">{player.name.split(" ")[0]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {view.comparison.map((row) => (
                    <tr key={row.label}>
                      <td className="px-5 py-2.5 text-slate-700">
                        {row.label}
                        {row.direction === "lower" && (
                          <span className="ml-1 text-xs text-slate-400">(lower is better)</span>
                        )}
                      </td>
                      <td className="stat-number px-3 py-2.5 text-right text-lg text-slate-500">{row.team}</td>
                      <td
                        className={cn(
                          "stat-number px-5 py-2.5 text-right text-lg font-bold",
                          row.childWins === null ? "text-slate-900" : row.childWins ? "text-emerald-700" : "text-slate-900",
                        )}
                      >
                        {row.child}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Parent-friendly summary */}
          {view.parentFriendly && (
            <section className="mt-6 rounded-lg bg-navy-900 p-6 text-white">
              <div className="flex items-center gap-2">
                <Lightbulb size={18} strokeWidth={2} className="text-orange-300" aria-hidden />
                <span className="eyebrow text-orange-300">In plain English</span>
              </div>
              <p className="mt-3 text-lg leading-relaxed">{view.parentFriendly}</p>
              <p className="mt-3 text-xs text-navy-300">
                {view.aiProvider === "anthropic" ? "Written by the AI coach from this season's numbers." : "Built from this season's numbers."}
              </p>
            </section>
          )}

          {/* Trend */}
          {view.trend.length > 1 && (
            <section className="mt-6">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Season trend</h2>
              <p className="mt-1 text-sm text-slate-600">Bank Account by tournament, oldest to newest, with pass rating alongside.</p>
              <div className="card mt-3 p-4">
                <PlayerTrendChart data={view.trend} primaryLabel="Pass rating" />
              </div>
            </section>
          )}

          {/* What to work on */}
          {view.improvementAreas.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">What to work on</h2>
              <p className="mt-1 text-sm text-slate-600">
                The same focus areas that go on the report card, with drills you can look up together.
              </p>
              <ol className="mt-3 grid gap-3 sm:grid-cols-3">
                {view.improvementAreas.map((area, i) => (
                  <li key={i} className="card p-4">
                    <div className="stat-number text-3xl font-bold leading-none text-orange-500">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="mt-2 font-display text-xl font-bold leading-tight text-slate-900">{area.metric}</div>
                    {(area.current !== "-" || area.target !== "-") && (
                      <div className="mt-1 text-xs text-slate-500">
                        now <span className="font-semibold text-slate-900">{area.current}</span> · goal{" "}
                        <span className="font-semibold text-emerald-700">{area.target}</span>
                      </div>
                    )}
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{area.detail}</p>
                    {area.youtubeQuery && (
                      <a
                        href={youtubeSearchUrl(area.youtubeQuery)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-700 hover:underline"
                      >
                        <CirclePlay size={16} strokeWidth={2} aria-hidden />
                        Watch drill videos
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Report cards */}
          {view.reportCard && (
            <div className="mt-8">
              <ParentReportCards data={view.reportCard} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
