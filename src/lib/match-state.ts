// What state a match is actually in, decided once and rendered from.
//
// The courtside page used to render a live match whether or not one had been
// started. A coach who dismissed the lineup landed on a fully interactive
// screen with nobody on the court: an empty grid, every player on the bench,
// no tap targets, and an opponent-error button that still wrote points to a
// match that had never begun. Nothing on the page said why.
//
// So the page renders from this instead of from whatever happens to be in
// memory. Four states, one of which is the honest answer to "the coach has
// not told us who is playing yet".

import type { MatchResult } from "@prisma/client";

export type MatchState =
  // Nobody on the court. Nothing can be recorded, and nothing pretends it can.
  | "no_lineup"
  // Six players placed, no points and no stats yet. Ready to start scoring.
  | "ready"
  // Scoring has begun.
  | "live"
  // The coach has ended it. Read only.
  | "ended";

export interface MatchStateInput {
  result: MatchResult | null;
  onCourtCount: number;
  // Total points scored across every set, either side.
  pointsScored: number;
  // Stat lines recorded for this match.
  statCount: number;
}

export function matchState(input: MatchStateInput): MatchState {
  if (input.result) return "ended";
  if (input.onCourtCount === 0) return "no_lineup";
  if (input.pointsScored > 0 || input.statCount > 0) return "live";
  return "ready";
}

// Whether anything on the page may write to this match. In no_lineup the
// answer is no, and the buttons are not rendered at all rather than rendered
// and ignored: a button that does nothing is the same bug from the coach's
// side, because they still cannot tell what is wrong.
export function canRecord(state: MatchState): boolean {
  return state === "ready" || state === "live";
}

// Ending a match that never began is what produced the one phantom row in
// production: a result, a score, and no stats.
export function canEnd(state: MatchState): boolean {
  return state === "ready" || state === "live";
}

// The sentence the page shows when there is nobody on the court. It says what
// is wrong and what to do about it, which "ON COURT (0/6)" did not.
export const NO_LINEUP_HEADLINE = "No one is on the court yet.";
export const NO_LINEUP_BODY =
  "Set the starting lineup and the court fills in. Until six players are on it, nothing can be recorded for this match.";
export const NO_LINEUP_ACTION = "Set the starting lineup";

// The same guard, in the middle of a match that already started. This should
// not be reachable, which is exactly why it is worth saying out loud rather
// than rendering an empty grid.
export const EMPTY_COURT_HEADLINE = "No one is on the court.";
export const EMPTY_COURT_BODY =
  "Stats cannot be recorded until the lineup is set.";
export const EMPTY_COURT_ACTION = "Open the lineup";
