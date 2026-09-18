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
import { cachedLive, matchLiveKey, teamLiveKey } from "@/lib/live-cache";
import {
  countersFrom,
  countersSince,
  playerBaseline,
  type PlayerCounters,
} from "@/lib/court-state";
import { weakEtag } from "@/lib/etag";
import type { ReportCardData } from "@/components/reports/cards/types";
import type { ImprovementArea } from "@/components/reports/utils/improvement-rules";

export type LiveStatus = "live" | "final" | "pending" | "none";

// A match counts as "in progress" while the coach hasn't finalized it and
// it was created recently. The 24h window stops an abandoned, never-ended
// match from showing LIVE forever.
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function matchStatus(
  match: { result: MatchResult | null; createdAt: Date; startedAt?: Date | null },
  hasStats: boolean,
  now = Date.now(),
): LiveStatus {
  if (match.result) return "final";
  // Started by the coach ("Start match") - live even if the match was
  // created days ahead with the tournament schedule.
  if (match.startedAt && now - match.startedAt.getTime() < LIVE_WINDOW_MS) return "live";
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

// Where the child is right now, from the courtside screen's synced lineup.
//   on_court     playing this moment
//   off_court    played earlier in this set, on the bench now
//   bench        on the match roster, not on court yet this set
//   not_in_match not part of this match at all
//   unknown      nothing synced for this match, so the app does not claim to
//                know. Matches scored before court sync existed land here, and
//                the view falls back to showing stats with no state message.
export type PlayerCourtState =
  | "on_court"
  | "off_court"
  | "bench"
  | "not_in_match"
  | "unknown";

export interface LiveSnapshot {
  status: LiveStatus;
  match: {
    id: string;
    opponent: string;
    teamName: string;
    matchNumber: number;
    tournamentName: string;
    tournamentDate: string; // ISO
    result: MatchResult | null;
    setsWon: number;
    setsLost: number;
  } | null;
  // The child's match totals. Never reset or hidden by a substitution.
  stats: LiveStats | null;
  // Recorded since the current set's lineup was synced. Null when the match
  // has no synced lineup, or when the player has no stat line.
  setStats: LiveStats | null;
  playerState: PlayerCourtState;
  bankAccount: {
    balance: number;
    // Shown instead of a negative balance on the parent's screen.
    deposits: number;
    withdrawals: number;
    rating: string;
    ratingLabel: string;
    ratingColor: string;
  } | null;
  // Live per-set scores synced from the courtside page (empty until the
  // coach scores a point).
  sets: { setNumber: number; us: number; them: number; decided: "us" | "them" | null }[];
  // Sets decided so far, counted from the scores. The scoreboard shows the
  // coach's own setsWon/setsLost once the match is final.
  setsTally: { us: number; them: number };
  // The set in progress: score plus the win probability after every point.
  currentSet: {
    setNumber: number;
    us: number;
    them: number;
    winChancePct: number | null; // null until 3 rallies have been played
    winChanceHistory: number[]; // 0..1 after each point, for the sparkline
    rallies: number;
  } | null;
  // When the match data last changed (latest set-score write, else match
  // creation) and when it was read from the database.
  lastUpdated: string | null; // ISO
  updatedAt: string; // ISO
  // Weak ETag of the substantive fields; the poll answers 304 to it.
  etag: string;
}

function liveStatsFromCounters(c: PlayerCounters): LiveStats {
  const srAttempts = c.sr0 + c.sr1 + c.sr2 + c.sr3;
  return {
    kills: c.kills,
    aces: c.aces,
    blocks: c.blocks,
    digs: c.digs,
    assists: c.assists,
    errors:
      c.serveErrors + c.attackErrors + c.generalErrors + c.blockErrors +
      c.settingErrors + c.digErrors,
    srAttempts,
    srAverage: srAttempts > 0 ? (c.sr1 + 2 * c.sr2 + 3 * c.sr3) / srAttempts : null,
  };
}

function liveStatsFrom(line: StatLine): LiveStats {
  return liveStatsFromCounters(countersFrom(line));
}

// ---------------------------------------------------------------------------
// Live data for parents. Two cached reads (see src/lib/live-cache.ts) feed
// every parent poll: the team context (who may watch whom, which match is
// current, the team's rally history) and the current match (stat lines, set
// scores). 200 parents on one match share one set of queries per 10-second
// window; the courtside routes invalidate the keys when they write.
// ---------------------------------------------------------------------------

export interface TeamLive {
  teamId: string;
  teamName: string;
  fetchedAt: string;
  allowParentView: boolean;
  // Coach setting. Off means the parent view says nothing at all about where
  // the child is standing, live or otherwise.
  showBenchStatusToParents: boolean;
  usesPositions: boolean;
  players: Record<
    string,
    { name: string; primaryPosition: Position; isActive: boolean; parentIds: string[] }
  >;
  latestMatchId: string | null;
  // Rally win rate from finished matches, excluding the current one.
  historicalRallyRate: number | null;
}

export interface MatchLive {
  fetchedAt: string;
  id: string;
  opponent: string;
  matchNumber: number;
  tournamentName: string;
  tournamentDate: string;
  result: MatchResult | null;
  setsWon: number;
  setsLost: number;
  createdAt: string;
  startedAt: string | null;
  statCount: number;
  lines: Record<string, StatLine>; // by playerId
  setScores: { setNumber: number; us: number; them: number; history: [number, number][]; updatedAt: string }[];
  // Synced by the courtside screen, ascending by set. Empty for matches scored
  // before court sync existed.
  courtStates: {
    setNumber: number;
    onCourt: string[];
    appeared: string[];
    roster: string[];
    baseline: unknown;
    updatedAt: string;
  }[];
}

const LATEST_MATCH_ORDER = [
  { tournament: { startDate: "desc" as const } },
  { matchNumber: "desc" as const },
  { createdAt: "desc" as const },
];

async function loadTeamLive(teamId: string): Promise<TeamLive | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      name: true,
      allowParentView: true,
      showBenchStatusToParents: true,
      usesPositions: true,
      players: {
        select: {
          id: true,
          name: true,
          primaryPosition: true,
          isActive: true,
          parentLinks: { select: { parentId: true } },
        },
      },
    },
  });
  if (!team) return null;
  // The match in progress wins: a started, unfinished match from the last day.
  // Otherwise the most recent match by schedule order.
  const latest =
    (await prisma.match.findFirst({
      where: { tournament: { teamId }, result: null, startedAt: { gte: new Date(Date.now() - LIVE_WINDOW_MS) } },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    })) ??
    (await prisma.match.findFirst({
      where: { tournament: { teamId } },
      orderBy: LATEST_MATCH_ORDER,
      select: { id: true },
    }));
  const historicalRallyRate = await teamHistoricalRallyRate(teamId, latest?.id);
  const players: TeamLive["players"] = {};
  for (const p of team.players) {
    players[p.id] = {
      name: p.name,
      primaryPosition: p.primaryPosition,
      isActive: p.isActive,
      parentIds: p.parentLinks.map((l) => l.parentId),
    };
  }
  return {
    teamId,
    teamName: team.name,
    fetchedAt: new Date().toISOString(),
    allowParentView: team.allowParentView,
    showBenchStatusToParents: team.showBenchStatusToParents,
    usesPositions: team.usesPositions,
    players,
    latestMatchId: latest?.id ?? null,
    historicalRallyRate,
  };
}

async function loadMatchLive(matchId: string): Promise<MatchLive | null> {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { name: true, startDate: true } },
      statLines: true,
      setScores: { orderBy: { setNumber: "asc" } },
      courtStates: { orderBy: { setNumber: "asc" } },
    },
  });
  if (!m) return null;
  const lines: MatchLive["lines"] = {};
  for (const l of m.statLines) lines[l.playerId] = l;
  return {
    fetchedAt: new Date().toISOString(),
    id: m.id,
    opponent: m.opponent,
    matchNumber: m.matchNumber,
    tournamentName: m.tournament.name,
    tournamentDate: m.tournament.startDate.toISOString(),
    result: m.result,
    setsWon: m.setsWon,
    setsLost: m.setsLost,
    createdAt: m.createdAt.toISOString(),
    startedAt: m.startedAt?.toISOString() ?? null,
    statCount: m.statLines.length,
    lines,
    setScores: m.setScores.map((sc) => ({
      setNumber: sc.setNumber,
      us: sc.us,
      them: sc.them,
      history: parseScoreHistory(sc.history),
      updatedAt: sc.updatedAt.toISOString(),
    })),
    courtStates: m.courtStates.map((cs) => ({
      setNumber: cs.setNumber,
      onCourt: cs.onCourt,
      appeared: cs.appeared,
      roster: cs.roster,
      baseline: cs.baseline,
      updatedAt: cs.updatedAt.toISOString(),
    })),
  };
}

export function getTeamLive(teamId: string): Promise<TeamLive | null> {
  return cachedLive(teamLiveKey(teamId), () => loadTeamLive(teamId));
}

export function getMatchLive(matchId: string): Promise<MatchLive | null> {
  return cachedLive(matchLiveKey(matchId), () => loadMatchLive(matchId));
}

function emptySnapshot(): LiveSnapshot {
  const base = {
    status: "none" as const,
    match: null,
    stats: null,
    setStats: null,
    playerState: "unknown" as const,
    bankAccount: null,
    sets: [],
    setsTally: { us: 0, them: 0 },
    currentSet: null,
    lastUpdated: null,
  };
  return { ...base, updatedAt: new Date().toISOString(), etag: weakEtag(base) };
}

// Where the child is, from the lineup the courtside screen synced. Everything
// here is a fact the coach's screen recorded; nothing is inferred from whether
// a player happens to have a stat yet, because "on court and quiet" and "on the
// bench" look identical in the counters.
export function playerCourtState(match: MatchLive, playerId: string): PlayerCourtState {
  const states = match.courtStates;
  const onMatchRoster =
    Boolean(match.lines[playerId]) ||
    states.some((cs) => cs.roster.includes(playerId) || cs.appeared.includes(playerId));
  if (!onMatchRoster) return "not_in_match";
  // Nothing synced for this match: say nothing rather than guess. A match
  // scored on an older client lands here and reads exactly as it did before.
  if (states.length === 0) return "unknown";
  const current = states[states.length - 1];
  if (current.onCourt.includes(playerId)) return "on_court";
  if (current.appeared.includes(playerId)) return "off_court";
  return "bench";
}

// Pure: one player's view of the cached match data. No database access, so
// it can run for every poll.
export function buildLivePayload(
  team: TeamLive,
  match: MatchLive | null,
  playerId: string,
): LiveSnapshot {
  const player = team.players[playerId];
  if (!player || !match) return emptySnapshot();

  const sets = match.setScores.map((sc) => ({
    setNumber: sc.setNumber,
    us: sc.us,
    them: sc.them,
    decided: setWinner(sc.us, sc.them, setRulesFor(sc.setNumber)),
  }));
  const lastSet = match.setScores[match.setScores.length - 1] ?? null;
  let currentSet: LiveSnapshot["currentSet"] = null;
  if (lastSet) {
    const history = lastSet.history.length > 0 ? lastSet.history : [[lastSet.us, lastSet.them] as [number, number]];
    const wc = computeSetWinChance(history, {
      setNumber: lastSet.setNumber,
      historicalRate: team.historicalRallyRate,
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

  const status = matchStatus(
    {
      result: match.result,
      createdAt: new Date(match.createdAt),
      startedAt: match.startedAt ? new Date(match.startedAt) : null,
    },
    match.statCount > 0,
  );
  const line = match.lines[playerId] ?? null;
  // Where the child is standing is a live fact and nothing else.
  //
  //   - the coach can turn it off entirely, and then nothing is said
  //   - once the match is over it stops being said, because a finished match
  //     is about what the child recorded, not where they were sitting
  //
  // Nothing about earlier sets is ever sent: the payload carries the current
  // set's state and no history, so there is nothing for a parent to scroll
  // back through.
  const rawState = playerCourtState(match, playerId);
  const playerState: PlayerCourtState =
    team.showBenchStatusToParents && status === "live" ? rawState : "unknown";
  // Recorded since this set's lineup was synced. The match totals
  // stay in `stats` either way: a substitution never takes numbers off screen.
  const currentCourt = match.courtStates[match.courtStates.length - 1] ?? null;
  const setStats =
    line && currentCourt && playerState !== "unknown"
      ? liveStatsFromCounters(countersSince(line, playerBaseline(currentCourt.baseline, playerId)))
      : null;
  const mode: BankAccountMode = team.usesPositions ? "positions" : "universal";
  const ba = line
    ? calculateBankAccount(line, (line.positionPlayed ?? player.primaryPosition) as Position, mode)
    : null;
  const lastUpdated = match.setScores.reduce(
    (latest, sc) => (sc.updatedAt > latest ? sc.updatedAt : latest),
    match.createdAt,
  );

  const content = {
    status,
    match: {
      id: match.id,
      opponent: match.opponent,
      teamName: team.teamName,
      matchNumber: match.matchNumber,
      tournamentName: match.tournamentName,
      tournamentDate: match.tournamentDate,
      result: match.result,
      setsWon: match.setsWon,
      setsLost: match.setsLost,
    },
    stats: line ? liveStatsFrom(line) : null,
    setStats,
    playerState,
    bankAccount: ba
      ? {
          balance: ba.balance,
          deposits: ba.deposits,
          withdrawals: ba.withdrawals,
          rating: ba.rating,
          ratingLabel: ba.ratingLabel,
          ratingColor: ba.ratingColor,
        }
      : null,
    sets,
    setsTally: {
      us: sets.filter((x) => x.decided === "us").length,
      them: sets.filter((x) => x.decided === "them").length,
    },
    currentSet,
  };
  return { ...content, lastUpdated, updatedAt: match.fetchedAt, etag: weakEtag(content) };
}

// The child's current / most recent match, for the page's first render. The
// poll endpoint builds the same payload from the same caches.
export async function buildLiveSnapshot(playerId: string): Promise<LiveSnapshot> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  });
  const team = player ? await getTeamLive(player.teamId) : null;
  if (!team || !team.players[playerId]) return emptySnapshot();
  const match = team.latestMatchId ? await getMatchLive(team.latestMatchId) : null;
  return buildLivePayload(team, match, playerId);
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
