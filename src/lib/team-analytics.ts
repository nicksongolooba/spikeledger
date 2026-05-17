// Server-side helpers that turn raw StatLine rows into the chart-friendly
// shapes used by the team / tournament / player pages.

import type { Position, StatLine, Player, Tournament } from "@prisma/client";
import { calculateAggregateBankAccount } from "@/engine/bank-account";
import type { BankAccountBarDatum } from "@/components/charts/BankAccountBars";

export interface PlayerBankAccountAgg {
  player: Player;
  bar: BankAccountBarDatum;
  matchesPlayed: number;
}

// Group stat lines by playerId and build the bar-chart datums.
export function buildPlayerBankAccountBars(
  players: Player[],
  statLines: StatLine[],
): PlayerBankAccountAgg[] {
  const linesByPlayer = new Map<string, StatLine[]>();
  for (const s of statLines) {
    if (!linesByPlayer.has(s.playerId)) linesByPlayer.set(s.playerId, []);
    linesByPlayer.get(s.playerId)!.push(s);
  }
  const out: PlayerBankAccountAgg[] = [];
  for (const p of players) {
    const lines = linesByPlayer.get(p.id) ?? [];
    if (lines.length === 0) continue;
    const ba = calculateAggregateBankAccount(lines, p.primaryPosition);
    const matchesPlayed = lines.filter((l) => !l.didNotPlay).length;
    // For dual-role players we display the position they played MOST often.
    const counts: Partial<Record<Position, number>> = {};
    for (const l of lines) {
      const pos = (l.positionPlayed ?? p.primaryPosition) as Position;
      counts[pos] = (counts[pos] ?? 0) + 1;
    }
    const mostPlayed = (Object.entries(counts).sort(
      ([, a], [, b]) => (b as number) - (a as number),
    )[0]?.[0] as Position) ?? p.primaryPosition;
    out.push({
      player: p,
      matchesPlayed,
      bar: {
        name: `${p.name}${p.number !== null ? ` #${p.number}` : ""}`,
        balance: ba.balance,
        ratio: ba.ratio,
        rating: ba.rating,
        ratingLabel: ba.ratingLabel,
        ratingColor: ba.ratingColor,
        position: mostPlayed,
      },
    });
  }
  return out;
}

export interface TournamentNetPoint {
  tournamentId: string;
  label: string;
  startDate: Date;
  kills: number;
  errors: number;
  net: number;
}

// Net production per tournament for the sparkline + trend lines.
export function buildTournamentNet(
  tournaments: Tournament[],
  statLines: Array<StatLine & { tournamentId?: string }>,
  matchTournamentMap: Map<string, string>,
): TournamentNetPoint[] {
  const totals = new Map<string, { kills: number; errors: number }>();
  for (const s of statLines) {
    if (s.didNotPlay) continue;
    const tid = matchTournamentMap.get(s.matchId);
    if (!tid) continue;
    const t = totals.get(tid) ?? { kills: 0, errors: 0 };
    t.kills += s.kills;
    t.errors +=
      s.serveErrors + s.attackErrors + s.generalErrors + s.blockErrors;
    totals.set(tid, t);
  }
  return [...tournaments]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((t) => {
      const totals_ = totals.get(t.id) ?? { kills: 0, errors: 0 };
      return {
        tournamentId: t.id,
        label: t.name,
        startDate: t.startDate,
        kills: totals_.kills,
        errors: totals_.errors,
        net: totals_.kills - totals_.errors,
      };
    });
}
