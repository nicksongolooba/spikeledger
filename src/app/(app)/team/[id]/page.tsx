import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getTeamForCoach } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import { BankAccountBars } from "@/components/charts/BankAccountBars";
import { NetProductionSparkline } from "@/components/charts/NetProductionSparkline";
import {
  buildPlayerBankAccountBars,
  buildTournamentNet,
} from "@/lib/team-analytics";
import { fmtNum, fmtSigned } from "@/engine/derived-stats";
import { TeamIntelligenceCard } from "@/components/ai/TeamIntelligenceCard";
import { CoachChat } from "@/components/ai/CoachChat";
import { hasFeature, getUpgradeReason } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const team = await getTeamForCoach(params.id, user.id);

  const [players, tournaments, statLines, matches] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: team.id },
      orderBy: [{ isActive: "desc" }, { number: "asc" }, { name: "asc" }],
    }),
    prisma.tournament.findMany({
      where: { teamId: team.id },
      orderBy: { startDate: "asc" },
      include: {
        _count: { select: { matches: true } },
        matches: { select: { result: true } },
      },
    }),
    prisma.statLine.findMany({
      where: { match: { tournament: { teamId: team.id } } },
    }),
    prisma.match.findMany({
      where: { tournament: { teamId: team.id } },
      select: { id: true, tournamentId: true, result: true, setsWon: true, setsLost: true },
    }),
  ]);

  const activePlayers = players.filter((p) => p.isActive);

  // Bank Account across the season for each player.
  const bankAccountBars = buildPlayerBankAccountBars(players, statLines);

  // Tournament net production for sparkline.
  const matchToTournament = new Map(matches.map((m) => [m.id, m.tournamentId]));
  const netPoints = buildTournamentNet(
    tournaments,
    statLines,
    matchToTournament,
  );

  // Aggregate counters.
  let totalKills = 0;
  let totalErrors = 0;
  let totalSr0 = 0,
    totalSr1 = 0,
    totalSr2 = 0,
    totalSr3 = 0;
  let totalMatchesPlayed = 0;
  for (const s of statLines) {
    if (s.didNotPlay) continue;
    totalKills += s.kills;
    totalErrors +=
      s.serveErrors + s.attackErrors + s.generalErrors + s.blockErrors;
    totalSr0 += s.sr0;
    totalSr1 += s.sr1;
    totalSr2 += s.sr2;
    totalSr3 += s.sr3;
  }
  totalMatchesPlayed = matches.length;
  const srAtt = totalSr0 + totalSr1 + totalSr2 + totalSr3;
  const srAvg = srAtt > 0 ? (totalSr1 + 2 * totalSr2 + 3 * totalSr3) / srAtt : 0;
  const wins = matches.filter((m) => m.result === "WIN").length;
  const losses = matches.filter((m) => m.result === "LOSS").length;
  const hasData = statLines.length > 0;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: team.name }]} />

      <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-2 text-sm text-slate-400">
            {team.ageGroup && (
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">
                {team.ageGroup}
              </span>
            )}
            {team.season && <span>{team.season}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/team/${team.id}/import`} className="btn-secondary">
            Import stats
          </Link>
          {statLines.length > 0 && (
            <Link
              href={`/reports/generate/${team.id}`}
              className="btn-secondary"
            >
              Season reports
            </Link>
          )}
          <Link href={`/team/${team.id}/roster`} className="btn-secondary">
            Manage Roster
          </Link>
          <Link href={`/team/${team.id}/tournament/new`} className="btn-primary">
            Add Tournament
          </Link>
        </div>
      </header>

      {/* Roster preview */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Roster</h2>
          <Link
            href={`/team/${team.id}/roster`}
            className="text-sm text-cyan-300 hover:text-cyan-200"
          >
            View all →
          </Link>
        </div>
        {activePlayers.length === 0 ? (
          <EmptyState
            title="No players yet"
            description="Add players so you can start tracking stats."
            action={
              <Link href={`/team/${team.id}/roster`} className="btn-primary">
                Add players
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {activePlayers.map((p) => (
              <Link
                key={p.id}
                href={`/reports/player/${p.id}`}
                className="card card-hover flex items-center gap-3 p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 stat-number text-sm font-bold">
                  {p.number ?? "-"}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-100">
                    {p.name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <PositionBadge position={p.primaryPosition} size="xs" />
                    {p.secondaryPosition && (
                      <PositionBadge position={p.secondaryPosition} size="xs" />
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Quick Stats</h2>
        {!hasData ? (
          <EmptyState
            title="Play your first tournament to see stats here"
            description="Once matches are logged, totals, Bank Account, and trends appear here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Record" value={`${wins}-${losses}`} accent="cyan" />
            <StatTile label="Matches" value={totalMatchesPlayed.toString()} />
            <StatTile
              label="Avg Kills/Match"
              value={
                totalMatchesPlayed > 0
                  ? fmtNum(totalKills / totalMatchesPlayed, 1)
                  : "-"
              }
              accent="emerald"
            />
            <StatTile
              label="Team SR Avg"
              value={srAtt > 0 ? fmtNum(srAvg, 2) : "-"}
              accent="cyan"
            />
            <div className="card p-4 sm:col-span-2 lg:col-span-4">
              <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide">
                <span className="text-slate-500">Net production trend</span>
                <span className="text-slate-400">
                  {netPoints.length > 0
                    ? `Latest: ${fmtSigned(netPoints[netPoints.length - 1].net)}`
                    : "-"}
                </span>
              </div>
              <NetProductionSparkline
                data={netPoints.map((p) => ({ label: p.label, net: p.net }))}
              />
            </div>
          </div>
        )}
      </section>

      {/* Tournaments */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tournaments</h2>
          <Link
            href={`/team/${team.id}/tournament/new`}
            className="text-sm text-cyan-300 hover:text-cyan-200"
          >
            + Add Tournament
          </Link>
        </div>
        {tournaments.length === 0 ? (
          <EmptyState
            title="No tournaments yet"
            description="Create a tournament to start logging matches."
            action={
              <Link
                href={`/team/${team.id}/tournament/new`}
                className="btn-primary"
              >
                Add tournament
              </Link>
            }
          />
        ) : (
          <div className="card divide-y divide-slate-800">
            {[...tournaments]
              .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
              .map((t) => {
                const w = t.matches.filter((m) => m.result === "WIN").length;
                const l = t.matches.filter((m) => m.result === "LOSS").length;
                return (
                  <Link
                    key={t.id}
                    href={`/team/${team.id}/tournament/${t.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-slate-800/40"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-100">{t.name}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <span>{formatDate(t.startDate)}</span>
                        <span>
                          {t._count.matches}{" "}
                          {t._count.matches === 1 ? "match" : "matches"}
                        </span>
                        {t.location && <span>{t.location}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="stat-number text-sm font-bold text-slate-200">
                        {w}-{l}
                      </div>
                      <div className="text-xs text-slate-500">record</div>
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </section>

      {/* Season Bank Account chart */}
      {bankAccountBars.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 text-lg font-semibold">Season Bank Account</h2>
          <p className="mb-3 text-sm text-slate-400">
            Cumulative deposits vs withdrawals, grouped by position so the
            comparison stays fair.
          </p>
          <BankAccountBars data={bankAccountBars.map((p) => p.bar)} />
        </section>
      )}

      {/* AI team intelligence */}
      {hasData && (
        <div className="mt-10">
          <TeamIntelligenceCard teamId={team.id} scope="season" />
        </div>
      )}

      <CoachChat
        teamId={team.id}
        canChat={hasFeature(user.plan, "coachChat")}
        upgradeText={getUpgradeReason(user.plan, "coach-chat").reason}
        contextType="team"
        contextName={team.name}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "red" | "cyan" | "violet";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "red"
        ? "text-red-300"
        : accent === "cyan"
          ? "text-cyan-300"
          : accent === "violet"
            ? "text-violet-300"
            : "text-slate-100";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`stat-number mt-1 text-2xl font-bold ${accentClass}`}>
        {value}
      </div>
    </div>
  );
}
