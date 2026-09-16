// =============================================================================
// SpikeLedger Bank Account engine - the position-fair evaluation algorithm.
// =============================================================================
// Every action is either a deposit (adds to the team) or a withdrawal (takes from it),
// but the rules differ by position group:
//
//   Libero/DS  - SR 2 IS a deposit (good passing is the job).
//                Attack errors / net errors don't count against them.
//   Hitter     - Only SR 3 (perfect pass) is a deposit; SR 2 is baseline.
//                Attack and net errors DO count.
//   Setter/MB  - Not in serve receive, so SR fields don't count either way.
//                Attack and net errors count.
//
// This module is pure and works on either a single StatLine row or an array
// (for tournament/season aggregates). Dual-role players are handled naturally:
// each StatLine carries its own positionPlayed, and the aggregate sums the
// per-line contributions - RS matches use hitter rules, libero matches use
// libero rules.

import type { Position, StatLine } from "@prisma/client";

export type PositionGroup = "libero_ds" | "hitter" | "setter_middle";

// How a team is scored. "positions" is the default position-fair ledger.
// "universal" is for teams that play without set positions (12U/13U, rec
// leagues): everyone rotates through everything, so everyone is scored on
// the same all-around formula:
//   deposits    = kills, aces, blocks, assists, digs, SR 2s, SR 3s
//   withdrawals = serve errors, attack errors, net errors, general errors, SR 0s
export type BankAccountMode = "positions" | "universal";

export const POSITION_GROUP_MAP: Record<Position, PositionGroup> = {
  L: "libero_ds",
  DS: "libero_ds",
  OH: "hitter",
  RS: "hitter",
  OPP: "hitter",
  UTIL: "hitter",
  MB: "setter_middle",
  S: "setter_middle",
};

export function positionGroupOf(pos: Position): PositionGroup {
  return POSITION_GROUP_MAP[pos];
}

export type Rating = "GREEN" | "BLUE" | "ORANGE" | "RED" | "GREY";

export const RATING_INFO: Record<
  Rating,
  { label: string; color: string }
> = {
  // Colors are chosen for white/light surfaces (report cards, player pages):
  // each passes 4.5:1 against white as text.
  //
  // The labels describe where a player is, not what they are worth. A twelve
  // year old reads her own report card eventually, and a phrase like "hurting
  // the team" is something she would carry around for a season. The maths
  // below is untouched: only what we call the result changed.
  GREEN: { label: "Strong contribution", color: "#1a7f4a" },
  BLUE: { label: "Solid", color: "#0369a1" },
  ORANGE: { label: "Building", color: "#b45309" },
  RED: { label: "Focus area", color: "#dc2626" },
  GREY: { label: "Not enough data yet", color: "#64748b" },
};

// Whether a parent-facing surface should lead with the balance itself.
//
// A negative balance is never the headline on anything a player or a parent
// reads. The deposits and the withdrawals say the same thing without handing a
// child one number to carry around, and the focus areas say what to do about
// it. Coach-only screens are free to show the plain number.
export function leadWithBalance(balance: number): boolean {
  return balance >= 0;
}

export interface BankAccountResult {
  deposits: number;
  withdrawals: number;
  balance: number;
  ratio: number; // 0..1, or 0 if no data
  rating: Rating;
  ratingLabel: string;
  ratingColor: string;
  depositBreakdown: Record<string, number>;
  withdrawalBreakdown: Record<string, number>;
  positionGroup: PositionGroup | null; // null if mixed across groups (e.g. dual-role aggregate)
}

// Subset of StatLine fields the engine actually consumes. Use this so the
// engine can be called from places that have a plain object (CSV import,
// optimistic UI) without needing a full Prisma StatLine.
export interface StatLineLike {
  kills: number;
  attackErrors: number;
  aces: number;
  serveErrors: number;
  blocks: number;
  blockErrors: number;
  assists: number;
  sr0: number;
  sr1: number;
  sr2: number;
  sr3: number;
  generalErrors: number;
  digs?: number; // only the universal formula reads it
}

function ratingFromRatio(deposits: number, withdrawals: number): {
  ratio: number;
  rating: Rating;
} {
  const total = deposits + withdrawals;
  if (total === 0) return { ratio: 0, rating: "GREY" };
  const ratio = deposits / total;
  if (ratio >= 0.65) return { ratio, rating: "GREEN" };
  if (ratio >= 0.5) return { ratio, rating: "BLUE" };
  if (ratio >= 0.35) return { ratio, rating: "ORANGE" };
  return { ratio, rating: "RED" };
}

function emptyResult(group: PositionGroup | null): BankAccountResult {
  return {
    deposits: 0,
    withdrawals: 0,
    balance: 0,
    ratio: 0,
    rating: "GREY",
    ratingLabel: RATING_INFO.GREY.label,
    ratingColor: RATING_INFO.GREY.color,
    depositBreakdown: {},
    withdrawalBreakdown: {},
    positionGroup: group,
  };
}

// Returns deposit and withdrawal contributions for one stat line under one
// position group's rules. Both maps include only the keys that contribute.
function contributionsFor(
  line: StatLineLike,
  group: PositionGroup | "universal",
): { deposits: Record<string, number>; withdrawals: Record<string, number> } {
  const deposits: Record<string, number> = {
    kills: line.kills,
    blocks: line.blocks,
    aces: line.aces,
    assists: line.assists,
  };
  const withdrawals: Record<string, number> = {
    serveErrors: line.serveErrors,
    generalErrors: line.generalErrors,
  };

  if (group === "universal") {
    // No-positions teams: everyone passes, hits, blocks and digs, so every
    // good action is a deposit and every error is a withdrawal.
    deposits.sr2 = line.sr2;
    deposits.sr3 = line.sr3;
    deposits.digs = line.digs ?? 0;
    withdrawals.sr0 = line.sr0;
    withdrawals.attackErrors = line.attackErrors;
    withdrawals.blockErrors = line.blockErrors;
    return { deposits, withdrawals };
  }

  if (group === "libero_ds") {
    // Liberos: passing IS the job, so SR 2 + SR 3 are deposits, SR 0 hurts.
    deposits.sr2 = line.sr2;
    deposits.sr3 = line.sr3;
    withdrawals.sr0 = line.sr0;
    // Liberos rarely attack or play at the net - those errors don't count.
  } else if (group === "hitter") {
    // Hitters: only perfect passes (SR 3) are deposits; good passes are baseline.
    deposits.sr3 = line.sr3;
    withdrawals.sr0 = line.sr0;
    withdrawals.attackErrors = line.attackErrors;
    withdrawals.blockErrors = line.blockErrors; // net touches during blocking
  } else {
    // Setters / Middles: not in serve receive, but they still attack and block.
    withdrawals.attackErrors = line.attackErrors;
    withdrawals.blockErrors = line.blockErrors;
  }

  return { deposits, withdrawals };
}

function sumValues(map: Record<string, number>) {
  let s = 0;
  for (const v of Object.values(map)) s += v;
  return s;
}

function mergeInto(
  target: Record<string, number>,
  source: Record<string, number>,
) {
  for (const [k, v] of Object.entries(source)) {
    if (v === 0) continue;
    target[k] = (target[k] ?? 0) + v;
  }
}

/**
 * Bank Account for one StatLine + its positionPlayed.
 */
export function calculateBankAccount(
  line: StatLineLike,
  positionPlayed: Position,
  mode: BankAccountMode = "positions",
): BankAccountResult {
  const group = positionGroupOf(positionPlayed);
  const { deposits, withdrawals } = contributionsFor(
    line,
    mode === "universal" ? "universal" : group,
  );
  const depositTotal = sumValues(deposits);
  const withdrawalTotal = sumValues(withdrawals);
  const balance = depositTotal - withdrawalTotal;
  const { ratio, rating } = ratingFromRatio(depositTotal, withdrawalTotal);

  // Drop zero-valued buckets to keep the breakdown readable.
  const trim = (m: Record<string, number>) =>
    Object.fromEntries(Object.entries(m).filter(([, v]) => v !== 0));

  return {
    deposits: depositTotal,
    withdrawals: withdrawalTotal,
    balance,
    ratio,
    rating,
    ratingLabel: RATING_INFO[rating].label,
    ratingColor: RATING_INFO[rating].color,
    depositBreakdown: trim(deposits),
    withdrawalBreakdown: trim(withdrawals),
    positionGroup: mode === "universal" ? null : group,
  };
}

/**
 * Bank Account across many StatLines.
 *
 * Each line is evaluated under the position group of its own `positionPlayed`
 * (so a dual-role player like Jordan gets RS rules on his RS matches and
 * libero rules on his libero matches). Then deposits and withdrawals are
 * summed across all lines - the resulting ratio is naturally weighted by
 * how many matches were played at each position.
 *
 * Pass `fallbackPosition` so lines without a stored positionPlayed (rare -
 * shouldn't happen post-Phase-2 lineup) still classify correctly.
 */
export function calculateAggregateBankAccount(
  lines: Array<Pick<
    StatLine,
    | "kills"
    | "attackErrors"
    | "aces"
    | "serveErrors"
    | "blocks"
    | "blockErrors"
    | "assists"
    | "sr0"
    | "sr1"
    | "sr2"
    | "sr3"
    | "generalErrors"
    | "positionPlayed"
  > & { digs?: number }>,
  fallbackPosition: Position,
  mode: BankAccountMode = "positions",
): BankAccountResult {
  if (lines.length === 0) {
    return emptyResult(mode === "universal" ? null : positionGroupOf(fallbackPosition));
  }

  const aggDeposits: Record<string, number> = {};
  const aggWithdrawals: Record<string, number> = {};
  const groupsSeen = new Set<PositionGroup>();

  for (const line of lines) {
    const pos = (line.positionPlayed ?? fallbackPosition) as Position;
    const group = positionGroupOf(pos);
    groupsSeen.add(group);
    const { deposits, withdrawals } = contributionsFor(
      line,
      mode === "universal" ? "universal" : group,
    );
    mergeInto(aggDeposits, deposits);
    mergeInto(aggWithdrawals, withdrawals);
  }

  const depositTotal = sumValues(aggDeposits);
  const withdrawalTotal = sumValues(aggWithdrawals);
  const { ratio, rating } = ratingFromRatio(depositTotal, withdrawalTotal);

  return {
    deposits: depositTotal,
    withdrawals: withdrawalTotal,
    balance: depositTotal - withdrawalTotal,
    ratio,
    rating,
    ratingLabel: RATING_INFO[rating].label,
    ratingColor: RATING_INFO[rating].color,
    depositBreakdown: aggDeposits,
    withdrawalBreakdown: aggWithdrawals,
    positionGroup:
      mode === "universal" ? null : groupsSeen.size === 1 ? [...groupsSeen][0] : null,
  };
}

// Friendly labels for the breakdown chart keys.
export const BREAKDOWN_LABELS: Record<string, string> = {
  digs: "Digs",
  kills: "Kills",
  blocks: "Blocks",
  aces: "Aces",
  assists: "Assists",
  sr2: "Good passes (SR 2)",
  sr3: "Perfect passes (SR 3)",
  serveErrors: "Serve errors",
  generalErrors: "General errors",
  attackErrors: "Attack errors",
  blockErrors: "Net errors",
  sr0: "Shanked passes (SR 0)",
};
