// Rate-based stats derived from raw StatLine rows.
// Rule of thumb: ALWAYS show per-match averages and percentages when comparing
// players, never raw totals - otherwise a starter and a sub aren't comparable.

import type { Position, StatLine } from "@prisma/client";
import {
  calculateAggregateBankAccount,
  type BankAccountMode,
  type BankAccountResult,
} from "./bank-account";

export interface DerivedStats {
  // Attacking
  hittingEfficiency: number; // (kills - errors) / attempts
  killsPerMatch: number;
  totalKills: number;
  // Zero means no attempts were recorded, not that efficiency was poor.
  totalAttackAttempts: number;
  totalAttackErrors: number;

  // Serving
  acePercentage: number;
  serveErrorPercentage: number;
  acesPerMatch: number;
  totalAces: number;
  totalServeAttempts: number;
  totalServeErrors: number;

  // Passing (serve receive)
  srAverage: number;            // weighted average on a 0-3 scale
  srTotal: number;              // number of passes received
  perfectPassPercentage: number; // sr3 / total
  passable: boolean;            // true if any SR data - drives "hide passing column" for setters/middles

  // Blocking
  blocksPerMatch: number;
  totalBlocks: number;

  // Setting
  assistsPerMatch: number;
  totalAssists: number;

  // Defense
  digsPerMatch: number;
  totalDigs: number;

  // Errors (rolled up)
  totalErrors: number;
  errorsPerMatch: number;

  // Bank Account
  bankAccount: BankAccountResult;

  // Meta
  matchesPlayed: number;
  setsPlayed: number;
}

type AggregatableLine = Pick<
  StatLine,
  | "kills"
  | "attackErrors"
  | "attackAttempts"
  | "aces"
  | "serveErrors"
  | "serveAttempts"
  | "blocks"
  | "blockErrors"
  | "assists"
  | "sr0"
  | "sr1"
  | "sr2"
  | "sr3"
  | "generalErrors"
  | "settingErrors"
  | "digErrors"
  | "digs"
  | "setsPlayed"
  | "didNotPlay"
  | "positionPlayed"
>;

function safeDiv(num: number, denom: number) {
  return denom > 0 ? num / denom : 0;
}

/**
 * Compute derived stats for an arbitrary collection of stat lines.
 * Counts a "match played" as any line that isn't flagged DNP.
 */
export function computeDerivedStats(
  lines: AggregatableLine[],
  fallbackPosition: Position,
  mode: BankAccountMode = "positions",
): DerivedStats {
  let kills = 0;
  let attackErrors = 0;
  let settingErrors = 0;
  let digErrors = 0;
  let attackAttempts = 0;
  let aces = 0;
  let serveErrors = 0;
  let serveAttempts = 0;
  let blocks = 0;
  let blockErrors = 0;
  let assists = 0;
  let sr0 = 0;
  let sr1 = 0;
  let sr2 = 0;
  let sr3 = 0;
  let generalErrors = 0;
  let digs = 0;
  let setsPlayed = 0;
  let matchesPlayed = 0;

  for (const l of lines) {
    if (l.didNotPlay) continue;
    matchesPlayed += 1;
    kills += l.kills;
    attackErrors += l.attackErrors;
    attackAttempts += l.attackAttempts;
    aces += l.aces;
    serveErrors += l.serveErrors;
    serveAttempts += l.serveAttempts;
    blocks += l.blocks;
    blockErrors += l.blockErrors;
    assists += l.assists;
    sr0 += l.sr0;
    sr1 += l.sr1;
    sr2 += l.sr2;
    sr3 += l.sr3;
    generalErrors += l.generalErrors;
    settingErrors += l.settingErrors ?? 0;
    digErrors += l.digErrors ?? 0;
    digs += l.digs;
    setsPlayed += l.setsPlayed;
  }

  const srTotal = sr0 + sr1 + sr2 + sr3;
  const srAverage = srTotal > 0 ? (sr1 + 2 * sr2 + 3 * sr3) / srTotal : 0;
  const perfectPassPercentage = safeDiv(sr3, srTotal);
  const totalErrors =
    serveErrors + attackErrors + generalErrors + blockErrors + settingErrors + digErrors;

  return {
    hittingEfficiency: safeDiv(kills - attackErrors, attackAttempts),
    killsPerMatch: safeDiv(kills, matchesPlayed),
    totalKills: kills,
    totalAttackErrors: attackErrors,
    // Exposed so callers can tell "efficiency is genuinely low" from
    // "efficiency was never measured". No button records an attempt, so this
    // is zero for every courtside-recorded player, and safeDiv turns that into
    // an efficiency of 0, which is below every bar there is.
    totalAttackAttempts: attackAttempts,

    acePercentage: safeDiv(aces, serveAttempts),
    serveErrorPercentage: safeDiv(serveErrors, serveAttempts),
    totalServeAttempts: serveAttempts,
    acesPerMatch: safeDiv(aces, matchesPlayed),
    totalAces: aces,
    totalServeErrors: serveErrors,

    srAverage,
    srTotal,
    perfectPassPercentage,
    passable: srTotal > 0,

    blocksPerMatch: safeDiv(blocks, matchesPlayed),
    totalBlocks: blocks,

    assistsPerMatch: safeDiv(assists, matchesPlayed),
    totalAssists: assists,

    digsPerMatch: safeDiv(digs, matchesPlayed),
    totalDigs: digs,

    totalErrors,
    errorsPerMatch: safeDiv(totalErrors, matchesPlayed),

    bankAccount: calculateAggregateBankAccount(lines, fallbackPosition, mode),

    matchesPlayed,
    setsPlayed,
  };
}

// Common formatters for display layer - kept here so the same numbers are
// rendered consistently everywhere.
export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
export function fmtNum(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}
export function fmtSigned(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}
