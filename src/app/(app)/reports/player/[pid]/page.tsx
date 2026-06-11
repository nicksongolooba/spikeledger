import Link from "next/link";
import { notFound } from "next/navigation";
import type { Position } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PositionBadge } from "@/components/ui/PositionBadge";
import {
  POSITION_GROUP_MAP,
  type PositionGroup,
} from "@/engine/bank-account";
import { computeDerivedStats, fmtNum, fmtPct, fmtSigned } from "@/engine/derived-stats";
import { BankAccountChip } from "@/components/charts/BankAccountChip";
import { BankAccountBreakdownPie } from "@/components/charts/BankAccountBreakdownPie";
import { PlayerTrendChart, type TrendPoint } from "@/components/charts/PlayerTrendChart";
import { POSITION_LABELS } from "@/lib/positions";
import { PlayerInsightPanel } from "@/components/ai/PlayerInsightPanel";
import { CoachChat } from "@/components/ai/CoachChat";
import { hasFeature, getUpgradeReason } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

interface StatTileItem {
  label: string;
  value: string;
  accent?: "emerald" | "red" | "cyan" | "violet" | "amber";
}

function statTilesFor(
  group: PositionGroup,
  s: ReturnType<typeof computeDerivedStats>,
): StatTileItem[] {
  if (group === "libero_ds") {
    return [
      { label: "SR Avg", value: s.srTotal > 0 ? fmtNum(s.srAverage, 2) : "-", accent: "emerald" },
      { label: "Perfect Pass %", value: s.srTotal > 0 ? fmtPct(s.perfectPassPercentage, 0) : "-", accent: "cyan" },
      { label: "Digs / Match", value: fmtNum(s.digsPerMatch, 1) },
      { label: "Errors / Match", value: fmtNum(s.errorsPerMatch, 1), accent: "red" },
    ];
  }
  if (group === "setter_middle") {
    // Combined view; per-position emphasis in labels.
    return [
      { label: "Assists / Match", value: fmtNum(s.assistsPerMatch, 1), accent: "cyan" },
      { label: "Blocks / Match", value: fmtNum(s.blocksPerMatch, 1), accent: "violet" },
      { label: "Kills / Match", value: fmtNum(s.killsPerMatch, 1), accent: "emerald" },
      { label: "Errors / Match", value: fmtNum(s.errorsPerMatch, 1), accent: "red" },
    ];
  }
  // hitter
  return [
    { label: "Kills / Match", value: fmtNum(s.killsPerMatch, 1), accent: "emerald" },
    {
      label: "Hitting %",
      value:
        s.totalKills + s.totalAttackErrors > 0
          ? fmtPct(s.hittingEfficiency, 1)
          : "-",
      accent: "amber",
    },
    { label: "Aces / Match", value: fmtNum(s.acesPerMatch, 1), accent: "cyan" },
    { label: "SR Avg", value: s.srTotal > 0 ? fmtNum(s.srAverage, 2) : "-" },
  ];
}

interface BreakdownRow {
  tournamentId: string;
  tournamentName: string;
  positionPlayed: Position | null;
  matchesPlayed: number;
  kills: number;
  aces: number;
  blocks: number;
  assists: number;
  digs: number;
  errors: number;
  srAvg: number | null;
  balance: number;
  rating: string;
  ratingColor: string;
}

export default async function PlayerReportPage({
  params,
}: {
  params: { pid: string };
}) {
  const user = await requireUser();

  const player = await prisma.player.findFirst({
    where: { id: params.pid, team: { coachId: user.id } },
    include: { team: true },
  });
  if (!player) notFound();

  const statLines = await prisma.statLine.findMany({
    where: { playerId: player.id },
    include: { match: { include: { tournament: true } } },
  });

  // Group by tournament.
  const tournamentMap = new Map<string, { id: string; name: string; date: Date; lines: typeof statLines }>();
  for (const sl of statLines) {
    const t = sl.match.tournament;
    if (!tournamentMap.has(t.id)) {
      tournamentMap.set(t.id, {
        id: t.id,
        name: t.name,
        date: t.startDate,
        lines: [],
      });
    }
    tournamentMap.get(t.id)!.lines.push(sl);
  }
  const tournaments = [...tournamentMap.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const overall = computeDerivedStats(
    statLines.map((s) => s),
    player.primaryPosition,
  );

  // Decide which position group to evaluate against. For dual-role players,
  // pick the one they played most often (that's also what the season Bank
  // Account weighting falls out to anyway).
  const positionCounts: Partial<Record<Position, number>> = {};
  for (const sl of statLines) {
    const p = (sl.positionPlayed ?? player.primaryPosition) as Position;
    positionCounts[p] = (positionCounts[p] ?? 0) + 1;
  }
  const mostPlayed = (Object.entries(positionCounts).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  )[0]?.[0] as Position | undefined) ?? player.primaryPosition;
  const group = POSITION_GROUP_MAP[mostPlayed];

  // Per-tournament breakdown
  const breakdown: BreakdownRow[] = tournaments.map((t) => {
    const ds = computeDerivedStats(t.lines, player.primaryPosition);
    // Position played most often in this tournament:
    const tPosCounts: Partial<Record<Position, number>> = {};
    for (const sl of t.lines) {
      const p = (sl.positionPlayed ?? player.primaryPosition) as Position;
      tPosCounts[p] = (tPosCounts[p] ?? 0) + 1;
    }
    const tMost =
      (Object.entries(tPosCounts).sort(
        ([, a], [, b]) => (b as number) - (a as number),
      )[0]?.[0] as Position | undefined) ?? player.primaryPosition;
    return {
      tournamentId: t.id,
      tournamentName: t.name,
      positionPlayed: tMost,
      matchesPlayed: ds.matchesPlayed,
      kills: ds.totalKills,
      aces: ds.totalAces,
      blocks: ds.totalBlocks,
      assists: ds.totalAssists,
      digs: ds.totalDigs,
      errors: ds.totalErrors,
      srAvg: ds.srTotal > 0 ? ds.srAverage : null,
      balance: ds.bankAccount.balance,
      rating: ds.bankAccount.rating,
      ratingColor: ds.bankAccount.ratingColor,
    };
  });

  // Trend data: per tournament. Primary metric depends on group.
  const trendData: TrendPoint[] = tournaments.map((t) => {
    const ds = computeDerivedStats(t.lines, player.primaryPosition);
    let primary = 0;
    if (group === "libero_ds") primary = ds.srAverage;
    else if (group === "setter_middle") {
      // Setters → assists/match; Middles → blocks/match
      if (mostPlayed === "S") primary = ds.assistsPerMatch;
      else primary = ds.blocksPerMatch;
    } else primary = ds.killsPerMatch;
    return {
      tournamentName: t.name,
      bankBalance: ds.bankAccount.balance,
      primary,
    };
  });

  const primaryLabel =
    group === "libero_ds"
      ? "SR Avg"
      : group === "setter_middle"
        ? mostPlayed === "S"
          ? "Assists/Match"
          : "Blocks/Match"
        : "Kills/Match";
  const primaryColor =
    group === "libero_ds"
      ? "#34d399"
      : group === "setter_middle"
        ? mostPlayed === "S"
          ? "#cbf03c"
          : "#a78bfa"
        : "#fbbf24";

  const tiles = statTilesFor(group, overall);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: player.team.name, href: `/team/${player.team.id}` },
          { label: player.name },
        ]}
      />

      {/* Header */}
      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 stat-number text-2xl font-bold">
            #{player.number ?? "-"}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {player.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-sm">
              <PositionBadge position={player.primaryPosition} />
              {player.secondaryPosition && (
                <PositionBadge position={player.secondaryPosition} />
              )}
              <span className="text-slate-400">
                · {player.team.name}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {statLines.length > 0 && (
            <Link
              href={`/reports/generate/${player.team.id}?player=${player.id}`}
              className="btn-primary"
            >
              Generate report card
            </Link>
          )}
          <Link href={`/team/${player.team.id}`} className="btn-secondary">
            Back to team
          </Link>
        </div>
      </header>

      {statLines.length === 0 ? (
        <div className="mt-8 card p-8 text-center">
          <p className="text-slate-400">
            {player.name} hasn&apos;t logged any stats yet. Stats from match
            entry will populate this report automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Bank Account card */}
          <section className="mt-6 card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Season Bank Account
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span
                    className="stat-number text-3xl font-bold"
                    style={{ color: overall.bankAccount.ratingColor }}
                  >
                    {fmtSigned(overall.bankAccount.balance)}
                  </span>
                  <BankAccountChip result={overall.bankAccount} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {overall.bankAccount.deposits} deposits ·{" "}
                  {overall.bankAccount.withdrawals} withdrawals ·{" "}
                  {(overall.bankAccount.ratio * 100).toFixed(0)}% ratio
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Evaluated as: <span className="text-slate-200">{POSITION_LABELS[mostPlayed]}</span></div>
                <div>{overall.matchesPlayed} matches · {overall.setsPlayed} sets</div>
              </div>
            </div>
          </section>

          {/* Stat tiles */}
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <StatTile key={t.label} {...t} />
            ))}
          </section>

          {/* AI coach analysis */}
          <section className="mt-8">
            <PlayerInsightPanel playerId={player.id} scope="season" />
          </section>

          {/* Breakdown pies */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Bank Account breakdown</h2>
            <BankAccountBreakdownPie
              deposits={overall.bankAccount.depositBreakdown}
              withdrawals={overall.bankAccount.withdrawalBreakdown}
            />
          </section>

          {/* Trend */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Tournament trend</h2>
            <div className="card p-4">
              <PlayerTrendChart
                data={trendData}
                primaryLabel={primaryLabel}
                primaryColor={primaryColor}
              />
            </div>
          </section>

          {/* Per-tournament breakdown table */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Per-tournament breakdown</h2>
            <div className="card overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Tournament</th>
                    <th className="px-3 py-2.5 text-left">Pos</th>
                    <th className="px-3 py-2.5 text-right">M</th>
                    <th className="px-3 py-2.5 text-right">K</th>
                    <th className="px-3 py-2.5 text-right">Aces</th>
                    <th className="px-3 py-2.5 text-right">Blk</th>
                    <th className="px-3 py-2.5 text-right">Ast</th>
                    <th className="px-3 py-2.5 text-right">Digs</th>
                    <th className="px-3 py-2.5 text-right">Errs</th>
                    <th className="px-3 py-2.5 text-right">SR</th>
                    <th className="px-3 py-2.5 text-right">Bank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {breakdown.map((b) => (
                    <tr key={b.tournamentId}>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-100">
                        {b.tournamentName}
                      </td>
                      <td className="px-3 py-2.5">
                        {b.positionPlayed && (
                          <PositionBadge position={b.positionPlayed} size="xs" />
                        )}
                      </td>
                      <td className="stat-number px-3 py-2.5 text-right">{b.matchesPlayed}</td>
                      <td className="stat-number px-3 py-2.5 text-right">{b.kills}</td>
                      <td className="stat-number px-3 py-2.5 text-right">{b.aces}</td>
                      <td className="stat-number px-3 py-2.5 text-right">{b.blocks}</td>
                      <td className="stat-number px-3 py-2.5 text-right">{b.assists}</td>
                      <td className="stat-number px-3 py-2.5 text-right">{b.digs}</td>
                      <td className="stat-number px-3 py-2.5 text-right">{b.errors}</td>
                      <td className="stat-number px-3 py-2.5 text-right">
                        {b.srAvg !== null ? fmtNum(b.srAvg, 2) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className="stat-number font-semibold"
                          style={{ color: b.ratingColor }}
                        >
                          {fmtSigned(b.balance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <CoachChat
        teamId={player.teamId}
        canChat={hasFeature(user.plan, "coachChat")}
        upgradeText={getUpgradeReason(user.plan, "coach-chat").reason}
        contextType="player"
        contextId={player.id}
        contextName={player.name}
      />
    </div>
  );
}

function StatTile({ label, value, accent }: StatTileItem) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "red"
        ? "text-red-300"
        : accent === "cyan"
          ? "text-volt-300"
          : accent === "violet"
            ? "text-violet-300"
            : accent === "amber"
              ? "text-amber-300"
              : "text-slate-100";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`stat-number mt-1 text-2xl font-bold ${accentClass}`}>
        {value}
      </div>
    </div>
  );
}
