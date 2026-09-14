// Everything the parent-facing pages render for ONE player. Built server-
// side so the pages stay thin, and so the privacy rule is enforced in one
// place: nothing here ever returns another player's name or stat line - only
// the child's numbers and team-wide averages.

import type { MatchResult, Position, StatLine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateBankAccount,
  type BankAccountMode,
} from "@/engine/bank-account";
import { computeDerivedStats } from "@/engine/derived-stats";
import { computeImprovementAreas } from "@/components/reports/utils/improvement-rules";
import { buildReportCardData } from "@/lib/report-data";
import { buildPlayerInsightRequest } from "@/engine/ai/request-builders";
import { generateRuleBasedPlayerInsight } from "@/engine/ai/rule-based";
import { getPlayerInsight } from "@/engine/ai";
import { getEffectivePlan } from "@/lib/club";
import { hasFeature } from "@/lib/plan-limits";
import { computeSetWinChance, setWinner, setRulesFor } from "@/engine/win-probability";
import { parseScoreHistory, teamHistoricalRallyRate } from "@/lib/win-probability-data";
import type { ReportCardData } from "@/components/reports/cards/types";
import type { ImprovementArea } from "@/components/reports/utils/improvement-rules";

export type LiveStatus = "live" | "final" | "pending" | "none";

// A match counts as "in progress" while the coach hasn't finalized it and
// it was created recently. The 24h window stops an abandoned, never-ended
// match from showing LIVE forever.
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function matchStatus(
  match: { result: MatchResult | null; createdAt: Date },
  hasStats: boolean,
  now = Date.now(),
): LiveStatus {
  if (match.result) return "final";
  if (hasStats && now - match.createdAt.getTime() < LIVE_WINDOW_MS) return "live";
  return "pending";
}

export interface LiveStats {
  kills: number;
  aces: number;
  blocks: number;
  digs: number;
  assists: number;
  errors: number;
  srAttempts: number;
  srAverage: number | null;
}

export interface LiveSnapshot {
  status: LiveStatus;
  match: {
    id: string;
    opponent: string;
    matchNumber: number;
    tournamentName: string;
    tournamentDate: string; // ISO
    result: MatchResult | null;
    setsWon: number;
    setsLost: number;
  } | null;
  stats: LiveStats | null;
  bankAccount: {
    balance: number;
    rating: string;
    ratingLabel: string;
    ratingColor: string;
  } | null;
  // Live per-set scores synced from the courtside page (empty until the
  // coach scores a point).
  sets: { setNumber: number; us: number; them: number; decided: "us" | "them" | null }[];
  // The set in progress: score plus the win probability after every point.
  currentSet: {
    setNumber: number;
    us: number;
    them: number;
    winChancePct: number | null; // null until 3 rallies have been played
    winChanceHistory: number[]; // 0..1 after each point, for the sparkline
    rallies: number;
  } | null;
  updatedAt: string; // ISO
}

function liveStatsFrom(line: StatLine): LiveStats {
  const srAttempts = line.sr0 + line.sr1 + line.sr2 + line.sr3;
  return {
    kills: line.kills,
    aces: line.aces,
    blocks: line.blocks,
    digs: line.digs,
    assists: line.assists,
    errors: line.serveErrors + line.attackErrors + line.generalErrors + line.blockErrors,
    srAttempts,
    srAverage:
      srAttempts > 0 ? (line.sr1 + 2 * line.sr2 + 3 * line.sr3) / srAttempts : null,
  };
}

// The child's current / most recent match. Polled by the parent view.
export async function buildLiveSnapshot(playerId: string): Promise<LiveSnapshot> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      primaryPosition: true,
      teamId: true,
      team: { select: { usesPositions: true } },
    },
  });
  const updatedAt = new Date().toISOString();
  const empty: LiveSnapshot = {
    status: "none",
    match: null,
    stats: null,
    bankAccount: null,
    sets: [],
    currentSet: null,
    updatedAt,
  };
  if (!player) return empty;

  const latest = await prisma.match.findFirst({
    where: { tournament: { teamId: player.teamId } },
    orderBy: [{ tournament: { startDate: "desc" } }, { matchNumber: "desc" }, { createdAt: "desc" }],
    include: {
      tournament: { select: { name: true, startDate: true } },
      _count: { select: { statLines: true } },
      statLines: { where: { playerId } },
      setScores: { orderBy: { setNumber: "asc" } },
    },
  });
  if (!latest) return empty;

  // Set scores + the win probability for the set in progress.
  const sets = latest.setScores.map((sc) => ({
    setNumber: sc.setNumber,
    us: sc.us,
    them: sc.them,
    decided: setWinner(sc.us, sc.them, setRulesFor(sc.setNumber)),
  }));
  const lastSet = latest.setScores[latest.setScores.length - 1] ?? null;
  let currentSet: LiveSnapshot["currentSet"] = null;
  if (lastSet) {
    const historicalRate = await teamHistoricalRallyRate(player.teamId, latest.id);
    const history = parseScoreHistory(lastSet.history);
    const wc = computeSetWinChance(history.length > 0 ? history : [[lastSet.us, lastSet.them]], {
      setNumber: lastSet.setNumber,
      historicalRate,
    });
    currentSet = {
      setNumber: lastSet.setNumber,
      us: lastSet.us,
      them: lastSet.them,
      winChancePct: wc.pct,
      winChanceHistory: wc.history,
      rallies: wc.rallies,
    };
  }

  const status = matchStatus(latest, latest._count.statLines > 0);
  const line = latest.statLines[0] ?? null;
  const mode: BankAccountMode = player.team.usesPositions ? "positions" : "universal";
  const ba = line
    ? calculateBankAccount(line, (line.positionPlayed ?? player.primaryPosition) as Position, mode)
    : null;

  return {
    status,
    match: {
      id: latest.id,
      opponent: latest.opponent,
      matchNumber: latest.matchNumber,
      tournamentName: latest.tournament.name,
      tournamentDate: latest.tournament.startDate.toISOString(),
      result: latest.result,
      setsWon: latest.setsWon,
      setsLost: latest.setsLost,
    },
    stats: line ? liveStatsFrom(line) : null,
    bankAccount: ba
      ? {
          balance: ba.balance,
          rating: ba.rating,
          ratingLabel: ba.ratingLabel,
          ratingColor: ba.ratingColor,
        }
      : null,
    sets,
    currentSet,
    updatedAt,
  };
}

export interface TeamComparisonRow {
  label: string;
  child: string;
  team: string;
  // "higher" = bigger is better, "lower" = smaller is better
  direction: "higher" | "lower";
  childWins: boolean | null;
}

export interface ParentPlayerView {
  player: { id: string; name: string; number: number | null; position: Position };
  team: { id: string; name: string; ageGroup: string | null; usesPositions: boolean };
  hasStats: boolean;
  season: ReturnType<typeof computeDerivedStats> | null;
  comparison: TeamComparisonRow[];
  trend: { tournamentName: string; bankBalance: number; primary: number }[];
  improvementAreas: ImprovementArea[];
  parentFriendly: string | null;
  aiProvider: "anthropic" | "rule-based" | null;
  reportCard: ReportCardData | null;
  live: LiveSnapshot;
}

function fmt(n: number, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

export async function buildParentPlayerView(playerId: string): Promise<ParentPlayerView | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: true },
  });
  if (!player) return null;
  const usesPositions = player.team.usesPositions;
  const mode: BankAccountMode = usesPositions ? "positions" : "universal";

  const [teamLines, live] = await Promise.all([
    prisma.statLine.findMany({
      where: { match: { tournament: { teamId: player.teamId } } },
      include: { match: { include: { tournament: { select: { id: true, name: true, startDate: true } } } } },
    }),
    buildLiveSnapshot(playerId),
  ]);
  const playerLines = teamLines.filter((l) => l.playerId === player.id);
  const hasStats = playerLines.some((l) => !l.didNotPlay);

  const base = {
    player: { id: player.id, name: player.name, number: player.number, position: player.primaryPosition },
    team: {
      id: player.team.id,
      name: player.team.name,
      ageGroup: player.team.ageGroup,
      usesPositions,
    },
    live,
  };
  if (!hasStats) {
    return {
      ...base,
      hasStats: false,
      season: null,
      comparison: [],
      trend: [],
      improvementAreas: [],
      parentFriendly: null,
      aiProvider: null,
      reportCard: null,
    };
  }

  const season = computeDerivedStats(playerLines, player.primaryPosition, mode);
  // Team averages are per player-match across the whole team - never a
  // single teammate's numbers.
  const teamAvg = computeDerivedStats(teamLines, player.primaryPosition, mode);
  const comparison: TeamComparisonRow[] = [
    {
      label: "Serve receive (0-3)",
      child: season.srTotal > 0 ? fmt(season.srAverage, 2) : "-",
      team: teamAvg.srTotal > 0 ? fmt(teamAvg.srAverage, 2) : "-",
      direction: "higher",
      childWins: season.srTotal > 0 && teamAvg.srTotal > 0 ? season.srAverage >= teamAvg.srAverage : null,
    },
    {
      label: "Kills per match",
      child: fmt(season.killsPerMatch),
      team: fmt(teamAvg.killsPerMatch),
      direction: "higher",
      childWins: season.killsPerMatch >= teamAvg.killsPerMatch,
    },
    {
      label: "Aces per match",
      child: fmt(season.acesPerMatch),
      team: fmt(teamAvg.acesPerMatch),
      direction: "higher",
      childWins: season.acesPerMatch >= teamAvg.acesPerMatch,
    },
    {
      label: "Digs per match",
      child: fmt(season.digsPerMatch),
      team: fmt(teamAvg.digsPerMatch),
      direction: "higher",
      childWins: season.digsPerMatch >= teamAvg.digsPerMatch,
    },
    {
      label: "Errors per match",
      child: fmt(season.errorsPerMatch),
      team: fmt(teamAvg.errorsPerMatch),
      direction: "lower",
      childWins: season.errorsPerMatch <= teamAvg.errorsPerMatch,
    },
  ];

  // Per-tournament trend, oldest first.
  const byTournament = new Map<string, { name: string; date: Date; lines: typeof playerLines }>();
  for (const l of playerLines) {
    const t = l.match.tournament;
    if (!byTournament.has(t.id)) byTournament.set(t.id, { name: t.name, date: t.startDate, lines: [] });
    byTournament.get(t.id)!.lines.push(l);
  }
  const buckets = [...byTournament.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  const trend = buckets.map((b) => {
    const ds = computeDerivedStats(b.lines, player.primaryPosition, mode);
    return { tournamentName: b.name, bankBalance: ds.bankAccount.balance, primary: ds.srTotal > 0 ? ds.srAverage : 0 };
  });

  const evaluatedAs = player.primaryPosition;
  const improvementAreas = computeImprovementAreas(season, evaluatedAs, player.name, {
    universal: !usesPositions,
  });

  // Parent-friendly summary. Parents inherit the coach's plan: with AI on the
  // coach's plan we use the cached AI insight, otherwise the rule-based one.
  const request = buildPlayerInsightRequest({
    player,
    usesPositions,
    scope: "season",
    scopeId: null,
    scopeLabel: "Full Season",
    ageGroup: player.team.ageGroup,
    playerLines,
    trendBuckets: buckets.map((b) => ({ label: b.name, lines: b.lines })),
  });
  const coachPlan = await getEffectivePlan(player.team.coachId);
  const insight = hasFeature(coachPlan, "aiInsights")
    ? await getPlayerInsight(request)
    : generateRuleBasedPlayerInsight(request);

  const reportCard = buildReportCardData({
    team: { id: player.team.id, name: player.team.name },
    scopeLabel: "Full Season",
    player,
    playerLines,
    cohort: [], // never compare a child against named teammates
    usesPositions,
  });
  reportCard.aiParentFriendly = insight.parentFriendly;
  reportCard.aiProvider = insight.provider;

  return {
    ...base,
    hasStats: true,
    season,
    comparison,
    trend,
    improvementAreas,
    parentFriendly: insight.parentFriendly,
    aiProvider: insight.provider,
    reportCard,
  };
}
