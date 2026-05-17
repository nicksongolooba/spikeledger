// Server-side: build the data payloads each report card needs from raw
// stat lines. Used by /reports/generate/[teamId] and /share/[id].

import type { Player, StatLine, Tournament, Position } from "@prisma/client";
import {
  POSITION_GROUP_MAP,
  type PositionGroup,
} from "@/engine/bank-account";
import { computeDerivedStats } from "@/engine/derived-stats";
import { computeImprovementAreas } from "@/components/reports/utils/improvement-rules";
import type { ReportCardData } from "@/components/reports/cards/types";

export interface RosterLike {
  id: string;
  name: string;
  number: number | null;
  primaryPosition: Position;
  secondaryPosition: Position | null;
}

export type StatLineLike = StatLine;

function mostPlayedPosition(
  lines: StatLine[],
  primary: Position,
): Position {
  const counts: Partial<Record<Position, number>> = {};
  for (const l of lines) {
    const p = (l.positionPlayed ?? primary) as Position;
    counts[p] = (counts[p] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  )[0]?.[0];
  return (top as Position | undefined) ?? primary;
}

// What the team-comparison card uses as the "primary stat" depends on the
// player's position group.
function primaryAndSecondaryFor(
  group: PositionGroup,
  position: Position,
  stats: ReturnType<typeof computeDerivedStats>,
): { primary: number; primaryLabel: string; secondary: number; secondaryLabel: string } {
  if (group === "libero_ds") {
    return {
      primary: stats.srAverage,
      primaryLabel: "SR Avg",
      secondary: stats.digsPerMatch,
      secondaryLabel: "Digs / Match",
    };
  }
  if (group === "setter_middle") {
    if (position === "S") {
      return {
        primary: stats.assistsPerMatch,
        primaryLabel: "Assists / Match",
        secondary: stats.acesPerMatch,
        secondaryLabel: "Aces / Match",
      };
    }
    return {
      primary: stats.blocksPerMatch,
      primaryLabel: "Blocks / Match",
      secondary: stats.killsPerMatch,
      secondaryLabel: "Kills / Match",
    };
  }
  return {
    primary: stats.killsPerMatch,
    primaryLabel: "Kills / Match",
    secondary: stats.acesPerMatch,
    secondaryLabel: "Aces / Match",
  };
}

interface BuildArgs {
  team: { id: string; name: string };
  scopeLabel: string;
  player: Player;
  playerLines: StatLine[];
  // Cohort = teammates we'll compare against. Pass only same-position-group
  // players from the caller.
  cohort: { player: Player; lines: StatLine[] }[];
}

export function buildReportCardData(args: BuildArgs): ReportCardData {
  const { player, playerLines, team, scopeLabel, cohort } = args;
  const evaluatedAs = mostPlayedPosition(playerLines, player.primaryPosition);
  const group = POSITION_GROUP_MAP[evaluatedAs];
  const stats = computeDerivedStats(playerLines, player.primaryPosition);

  const cohortRows = cohort.map(({ player: p, lines }) => {
    const ds = computeDerivedStats(lines, p.primaryPosition);
    const pos = mostPlayedPosition(lines, p.primaryPosition);
    const pg = POSITION_GROUP_MAP[pos];
    const { primary, primaryLabel, secondary, secondaryLabel } =
      primaryAndSecondaryFor(pg, pos, ds);
    return {
      playerId: p.id,
      name: `${p.name}${p.number !== null ? ` #${p.number}` : ""}`,
      bankBalance: ds.bankAccount.balance,
      primaryStat: primary,
      primaryStatLabel: primaryLabel,
      errorsPerMatch: ds.errorsPerMatch,
      secondaryStat: secondary,
      secondaryStatLabel: secondaryLabel,
    };
  });

  return {
    player: {
      id: player.id,
      name: player.name,
      number: player.number,
      position: evaluatedAs,
      primaryPosition: player.primaryPosition,
      secondaryPosition: player.secondaryPosition,
    },
    team,
    scopeLabel,
    stats,
    bankAccount: stats.bankAccount,
    improvementAreas: computeImprovementAreas(stats, evaluatedAs, player.name),
    cohort: cohortRows,
  };
}

// Group players in a roster by their (most-played) position group, so we know
// who to put in each cohort.
export function buildCohorts(
  players: Player[],
  linesByPlayer: Map<string, StatLine[]>,
): Map<PositionGroup, { player: Player; lines: StatLine[] }[]> {
  const out = new Map<PositionGroup, { player: Player; lines: StatLine[] }[]>();
  for (const p of players) {
    const lines = linesByPlayer.get(p.id) ?? [];
    const pos = mostPlayedPosition(lines, p.primaryPosition);
    const group = POSITION_GROUP_MAP[pos];
    if (!out.has(group)) out.set(group, []);
    out.get(group)!.push({ player: p, lines });
  }
  return out;
}

export interface ScopeDefinition {
  label: string;
  matchFilter: (m: { tournamentId: string }) => boolean;
}

export function tournamentScope(t: Tournament): ScopeDefinition {
  return {
    label: t.name,
    matchFilter: (m) => m.tournamentId === t.id,
  };
}

export function seasonScope(): ScopeDefinition {
  return {
    label: "Full Season",
    matchFilter: () => true,
  };
}
