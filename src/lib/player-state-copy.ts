// Every word a parent reads about where their child is standing right now.
//
// Playing time is the most charged subject between volleyball parents and
// coaches, so this file states facts and stops. It never gives a reason for a
// substitution, never counts sets or minutes played, never mentions another
// player, and never implies a judgement about how the child is doing.
//
// Two rules are enforced by scripts/verify-parent-flow.mts rather than left to
// good intentions:
//   1. none of FORBIDDEN_WORDS appears in any string this file produces
//   2. no third-person pronoun appears either. The app stores no gender for a
//      player, so "her stats" would be a guess. The child's own name carries
//      the sentence instead.

import type { PlayerCourtState } from "@/lib/parent-view";

// Words that carry a verdict rather than a fact.
export const FORBIDDEN_WORDS = [
  "benched",
  "sat",
  "sat out",
  "pulled",
  "removed",
  "dropped",
  "cut",
  "didn't play",
  "did not play",
  "not playing",
  "replaced",
  "instead of",
  "in place of",
];

// The app never learns a player's pronouns, so it never uses one.
export const FORBIDDEN_PRONOUNS = ["she", "her", "hers", "he", "him", "his"];

export interface PlayerStateCopy {
  // Short label next to the child's name. Null when there is nothing to say.
  chip: string | null;
  // The sentence in the body of the card. Null when the state needs none.
  message: string | null;
  // Labels the big stat grid, which always shows match totals. Those totals
  // never reset or drop when a child comes off the court.
  matchStatsLabel: string;
  // Labels the one-line per-set figure, shown only when there is one. Null
  // means the state has nothing extra to say about this set.
  setStatsLabel: string | null;
}

export function playerStateCopy(state: PlayerCourtState, firstName: string): PlayerStateCopy {
  switch (state) {
    case "on_court":
      return {
        chip: "On court",
        message: null,
        matchStatsLabel: "This match so far",
        setStatsLabel: null,
      };
    case "bench":
      return {
        chip: "On the bench",
        message: `${firstName} is on the bench this set. Stats will update as soon as ${firstName} goes in.`,
        matchStatsLabel: "Earlier in this match",
        setStatsLabel: null,
      };
    case "off_court":
      return {
        chip: "Off the court",
        message: `${firstName} is off the court right now.`,
        matchStatsLabel: "This match so far",
        setStatsLabel: `${firstName}'s stats this set so far`,
      };
    case "not_in_match":
      return {
        chip: null,
        message: `${firstName} is not in this match.`,
        matchStatsLabel: "This match so far",
        setStatsLabel: null,
      };
    case "unknown":
    default:
      return { chip: null, message: null, matchStatsLabel: "This match so far", setStatsLabel: null };
  }
}

// Shown for a few seconds when a child goes back on, so a parent glancing at
// the phone catches the change instead of wondering when it happened.
export const BACK_ON_COURT_CHIP = "Back on court";
