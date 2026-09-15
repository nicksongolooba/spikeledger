import Link from "next/link";
import {
  ArrowRight,
  FileImage,
  Lock,
  MapPin,
  Plus,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { getTeamForCoach } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatDate, pluralize } from "@/lib/utils";
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
import { getEffectivePlan } from "@/lib/club";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const effectivePlan = await getEffectivePlan(user.id);
  const team = await getTeamForCoach(params.id, user.id);
  const canManage = team.coachId === user.id;

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
  const usesPositions = team.usesPositions;

  // Bank Account across the season for each player.
  const bankAccountBars = buildPlayerBankAccountBars(
    players,
    statLines,
    usesPositions ? "positions" : "universal",
  );

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

  const latestNet =
    netPoints.length > 0 ? netPoints[netPoints.length - 1].net : null;
  const eyebrow =
    [team.ageGroup, team.season].filter(Boolean).join(" · ") || "Team";
  const recentTournaments = [...tournaments].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: team.name }]} />

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
            {team.name}
          </h1>
          {!canManage && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600">
              <Lock size={12} strokeWidth={2} aria-hidden />
              Shared club team - view only
            </div>
          )}
          {!usesPositions && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600">
              No set positions - everyone rotates through everything
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Link href={`/team/${team.id}/import`} className="btn-secondary">
              <Upload size={16} strokeWidth={2} aria-hidden />
              Import stats
            </Link>
          )}
          {statLines.length > 0 && (
            <Link
              href={`/reports/generate/${team.id}`}
              className="btn-secondary"
            >
              <FileImage size={16} strokeWidth={2} aria-hidden />
              Season reports
            </Link>
          )}
          {canManage && (
            <Link href={`/team/${team.id}/roster`} className="btn-secondary">
              <Users size={16} strokeWidth={2} aria-hidden />
              Manage roster
            </Link>
          )}
          {canManage && (
            <Link href={`/team/${team.id}/settings`} className="btn-secondary">
              <Settings size={16} strokeWidth={2} aria-hidden />
              Settings
            </Link>
          )}
          {canManage && (
            <Link href={`/team/${team.id}/tournament/new`} className="btn-primary">
              <Plus size={18} strokeWidth={2} aria-hidden />
              Add tournament
            </Link>
          )}
        </div>
      </header>

      {/* Season at a glance: four headline tiles, then the wide trend card */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Season at a glance
          </h2>
          {hasData && (
            <span className="text-sm text-slate-500">
              {totalMatchesPlayed} {pluralize(totalMatchesPlayed, "match", "matches")}{" "}
              logged
            </span>
          )}
        </div>
        {!hasData ? (
          <EmptyState
            className="mt-4"
            title="Play your first tournament to see stats here"
            description="Once a match is logged, the record, kills per match, pass rating and Bank Account all show up here."
          />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Record" value={`${wins}-${losses}`} featured />
              <StatTile label="Matches" value={totalMatchesPlayed.toString()} />
              <StatTile
                label="Kills / match"
                value={
                  totalMatchesPlayed > 0
                    ? fmtNum(totalKills / totalMatchesPlayed, 1)
                    : "-"
                }
                accent="emerald"
              />
              <StatTile
                label="Team SR avg"
                value={srAtt > 0 ? fmtNum(srAvg, 2) : "-"}
                accent="cyan"
              />
            </div>
            <div className="card mt-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow text-slate-500">
                    Net production by tournament
                  </div>
                  <div className="mt-0.5 text-sm text-slate-600">
                    One point per tournament, oldest to newest.
                  </div>
                </div>
                {latestNet !== null && (
                  <div className="text-right">
                    <div className="eyebrow text-[10px] text-slate-500">Latest</div>
                    <div
                      className={cn(
                        "stat-number text-2xl font-bold leading-none",
                        latestNet >= 0 ? "text-green-700" : "text-red-700",
                      )}
                    >
                      {fmtSigned(latestNet)}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <NetProductionSparkline
                  data={netPoints.map((p) => ({ label: p.label, net: p.net }))}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* Tournaments as a list, roster as a compact grid beside it */}
      <section className="mt-10 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Tournaments
            </h2>
            {tournaments.length > 0 && (
              <Link
                href={`/team/${team.id}/tournament/new`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:text-cyan-800"
              >
                <Plus size={14} strokeWidth={2} aria-hidden />
                Add tournament
              </Link>
            )}
          </div>
          {tournaments.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No tournaments yet"
              description="Create a tournament to start logging matches."
              action={
                <Link
                  href={`/team/${team.id}/tournament/new`}
                  className="btn-primary"
                >
                  <Plus size={18} strokeWidth={2} aria-hidden />
                  Add tournament
                </Link>
              }
            />
          ) : (
            <div className="card mt-4 divide-y divide-slate-100 overflow-hidden">
              {recentTournaments.map((t) => {
                const w = t.matches.filter((m) => m.result === "WIN").length;
                const l = t.matches.filter((m) => m.result === "LOSS").length;
                return (
                  <Link
                    key={t.id}
                    href={`/team/${team.id}/tournament/${t.id}`}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
                  >
                    <DateBlock date={t.startDate} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-900 transition-colors group-hover:text-cyan-700">
                        {t.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <span>
                          {t._count.matches}{" "}
                          {pluralize(t._count.matches, "match", "matches")}
                        </span>
                        {t.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} strokeWidth={2} aria-hidden />
                            {t.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="stat-number text-xl font-bold leading-none text-slate-900">
                        {w}-{l}
                      </div>
                      <div className="eyebrow mt-1 text-[10px] text-slate-500">
                        Record
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      strokeWidth={2}
                      className="shrink-0 text-slate-300 transition-colors group-hover:text-cyan-600"
                      aria-hidden
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Roster
            </h2>
            <Link
              href={`/team/${team.id}/roster`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:text-cyan-800"
            >
              View all
              <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </Link>
          </div>
          {activePlayers.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No players yet"
              description="Add players so you can start tracking stats."
              action={
                <Link href={`/team/${team.id}/roster`} className="btn-primary">
                  <Plus size={18} strokeWidth={2} aria-hidden />
                  Add players
                </Link>
              }
            />
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-2.5">
              {activePlayers.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/reports/player/${p.id}`}
                    className="card card-hover flex items-center gap-3 p-3"
                  >
                    <span className="stat-number flex h-10 w-10 shrink-0 items-center justify-center rounded bg-navy-900 text-base font-bold text-white">
                      {p.number ?? "-"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {p.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        <PositionBadge position={p.primaryPosition} size="xs" neutral={!usesPositions} />
                        {usesPositions && p.secondaryPosition && (
                          <PositionBadge position={p.secondaryPosition} size="xs" />
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Season Bank Account chart */}
      {bankAccountBars.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Season Bank Account
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {usesPositions
              ? "Deposits against withdrawals for the whole season, grouped by position so a libero is never lined up next to a hitter."
              : "Deposits against withdrawals for the whole season. This team plays without set positions, so everyone is scored on the same all-around formula."}
          </p>
          <div className="mt-4">
            <BankAccountBars
              data={bankAccountBars.map((p) => p.bar)}
              grouped={usesPositions}
            />
          </div>
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
        canChat={hasFeature(effectivePlan, "coachChat")}
        upgradeText={getUpgradeReason(effectivePlan, "coach-chat").reason}
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
  featured,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "red" | "cyan" | "violet";
  featured?: boolean;
}) {
  if (featured) {
    return (
      <div className="rounded-lg bg-navy-900 p-5 text-white shadow-card">
        <div className="eyebrow text-cyan-500">{label}</div>
        <div className="stat-number mt-2 text-4xl font-bold leading-none">
          {value}
        </div>
      </div>
    );
  }
  const accentClass =
    accent === "emerald"
      ? "text-green-700"
      : accent === "red"
        ? "text-red-700"
        : accent === "cyan"
          ? "text-navy-700"
          : accent === "violet"
            ? "text-cyan-700"
            : "text-slate-900";
  return (
    <div className="card p-5">
      <div className="eyebrow text-slate-500">{label}</div>
      <div
        className={cn(
          "stat-number mt-2 text-4xl font-bold leading-none",
          accentClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}

// Calendar-style date block for list rows: short month over the day number.
function DateBlock({ date }: { date: Date }) {
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return (
    <div
      title={formatDate(date)}
      className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded bg-slate-100 text-slate-900"
    >
      <span className="font-display text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {month}
      </span>
      <span className="stat-number text-xl font-bold leading-none">
        {date.getDate()}
      </span>
    </div>
  );
}
