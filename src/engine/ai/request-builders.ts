// Translates DB shapes into the strict InsightRequest payloads the engine
// expects. Centralising this so the API routes stay thin.

import type { Player, StatLine, Tournament, Position } from "@prisma/client";
import {
  POSITION_GROUP_MAP,
  calculateAggregateBankAccount,
  type PositionGroup,
} from "@/engine/bank-account";
import { computeDerivedStats } from "@/engine/derived-stats";
import type {
  PlayerInsightRequest,
  TeamInsightRequest,
} from "./types";

function mostPlayed(lines: StatLine[], fallback: Position): Position {
  const counts: Partial<Record<Position, number>> = {};
  for (const l of lines) {
    const p = (l.positionPlayed ?? fallback) as Position;
    counts[p] = (counts[p] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  )[0]?.[0];
  return (top as Position | undefined) ?? fallback;
}

// Pick the stat keys that matter for this group; pruning keeps the prompt
// small and tells the model what to focus on.
export function statsForGroup(
  group: PositionGroup,
  derived: ReturnType<typeof computeDerivedStats>,
): Record<string, number> {
  if (group === "libero_ds") {
    return {
      matchesPlayed: derived.matchesPlayed,
      srAverage: derived.srAverage,
      srTotal: derived.srTotal,
      perfectPassPercentage: derived.perfectPassPercentage,
      digsPerMatch: derived.digsPerMatch,
      acesPerMatch: derived.acesPerMatch,
      totalServeErrors: derived.totalServeErrors,
      serveErrorPercentage: derived.serveErrorPercentage,
      errorsPerMatch: derived.errorsPerMatch,
    };
  }
  if (group === "setter_middle") {
    return {
      matchesPlayed: derived.matchesPlayed,
      assistsPerMatch: derived.assistsPerMatch,
      blocksPerMatch: derived.blocksPerMatch,
      killsPerMatch: derived.killsPerMatch,
      hittingEfficiency: derived.hittingEfficiency,
      acesPerMatch: derived.acesPerMatch,
      serveErrorPercentage: derived.serveErrorPercentage,
      errorsPerMatch: derived.errorsPerMatch,
    };
  }
  return {
    matchesPlayed: derived.matchesPlayed,
    killsPerMatch: derived.killsPerMatch,
    hittingEfficiency: derived.hittingEfficiency,
    totalKills: derived.totalKills,
    totalAttackErrors: derived.totalAttackErrors,
    acesPerMatch: derived.acesPerMatch,
    serveErrorPercentage: derived.serveErrorPercentage,
    srAverage: derived.srAverage,
    srTotal: derived.srTotal,
    errorsPerMatch: derived.errorsPerMatch,
  };
}

export interface BuildPlayerInsightArgs {
  player: Player;
  scope: "match" | "tournament" | "season";
  scopeId: string | null;
  scopeLabel: string;
  ageGroup?: string | null;
  playerLines: StatLine[];
  trendBuckets?: Array<{ label: string; lines: StatLine[] }>;
  teamContext?: {
    teamName: string;
    record: string;
    avgStats: Record<string, number>;
  };
}

export function buildPlayerInsightRequest(
  args: BuildPlayerInsightArgs,
): PlayerInsightRequest {
  const evaluatedAs = mostPlayed(args.playerLines, args.player.primaryPosition);
  const group = POSITION_GROUP_MAP[evaluatedAs];
  const derived = computeDerivedStats(args.playerLines, args.player.primaryPosition);
  const stats = statsForGroup(group, derived);
  const bankAccount = derived.bankAccount;

  const trend = args.trendBuckets?.map((b) => {
    const ds = computeDerivedStats(b.lines, args.player.primaryPosition);
    return {
      scopeLabel: b.label,
      stats: statsForGroup(group, ds),
      bankAccount: {
        balance: ds.bankAccount.balance,
        rating: ds.bankAccount.rating,
        ratingLabel: ds.bankAccount.ratingLabel,
      },
    };
  });

  return {
    kind: "player",
    scope: args.scope,
    scopeId: args.scopeId,
    scopeLabel: args.scopeLabel,
    ageGroup: args.ageGroup ?? null,
    player: {
      id: args.player.id,
      name: args.player.name,
      position: evaluatedAs,
      positionGroup: group,
      primaryPosition: args.player.primaryPosition,
    },
    stats,
    bankAccount,
    trend,
    teamContext: args.teamContext,
  };
}

export interface BuildTeamInsightArgs {
  team: { id: string; name: string };
  ageGroup?: string | null;
  scope: "tournament" | "season";
  scopeId: string | null;
  scopeLabel: string;
  tournaments: Array<{
    tournament: Tournament;
    matches: Array<{ result: "WIN" | "LOSS" | "DRAW" | null }>;
    statLines: StatLine[];
  }>;
  roster: Player[];
  // statLines scoped to the requested scope, per player
  scopedLinesByPlayer: Map<string, StatLine[]>;
}

export function buildTeamInsightRequest(args: BuildTeamInsightArgs): TeamInsightRequest {
  const trend = args.tournaments
    .map((t) => {
      const wins = t.matches.filter((m) => m.result === "WIN").length;
      const losses = t.matches.filter((m) => m.result === "LOSS").length;
      let kills = 0;
      let errors = 0;
      let sr0 = 0;
      let sr1 = 0;
      let sr2 = 0;
      let sr3 = 0;
      for (const s of t.statLines) {
        if (s.didNotPlay) continue;
        kills += s.kills;
        errors += s.serveErrors + s.attackErrors + s.generalErrors + s.blockErrors;
        sr0 += s.sr0;
        sr1 += s.sr1;
        sr2 += s.sr2;
        sr3 += s.sr3;
      }
      const srAtt = sr0 + sr1 + sr2 + sr3;
      const srAverage = srAtt > 0 ? (sr1 + 2 * sr2 + 3 * sr3) / srAtt : 0;
      return {
        name: t.tournament.name,
        record: `${wins}-${losses}`,
        netProduction: kills - errors,
        srAverage,
        kills,
        errors,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const playerBankAccounts = args.roster
    .map((p) => {
      const lines = args.scopedLinesByPlayer.get(p.id) ?? [];
      if (lines.length === 0) return null;
      const pos = mostPlayed(lines, p.primaryPosition);
      const ba = calculateAggregateBankAccount(lines, p.primaryPosition);
      return {
        name: p.name,
        position: pos,
        balance: ba.balance,
        rating: ba.rating,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  let totalWins = 0;
  let totalLosses = 0;
  for (const t of trend) {
    const [w, l] = t.record.split("-").map((n) => parseInt(n, 10) || 0);
    totalWins += w;
    totalLosses += l;
  }

  return {
    kind: "team",
    scope: args.scope,
    scopeId: args.scopeId,
    scopeLabel: args.scopeLabel,
    ageGroup: args.ageGroup ?? null,
    team: args.team,
    record: `${totalWins}-${totalLosses}`,
    tournamentTrend: trend,
    playerBankAccounts,
  };
}
