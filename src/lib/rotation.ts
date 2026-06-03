// Pure side-out / rotation rules for the courtside entry page. Kept free of
// React so the volleyball logic can be unit-tested on its own.

import type { StatActionId } from "./stat-actions";

export type Serving = "us" | "them";

export interface RallyState {
  serving: Serving;
  rotation: number; // 1..6
}

export interface RallyOutcome extends RallyState {
  // True only when the rotation advanced, so the UI knows to flash R#.
  rotated: boolean;
}

// Next rotation in the 1..6 cycle: R6 wraps back to R1.
export function nextRotation(r: number): number {
  return (r % 6) + 1;
}

// Some actions only happen on our serve - an ace or a serve error prove we
// were the serving team, regardless of what the toggle said. Returning a
// value here lets applyRally correct a wrong toggle without faking a rotation.
export function servingAssertionFor(action: StatActionId): Serving | undefined {
  return action === "ACE" || action === "S_ERR" ? "us" : undefined;
}

// Apply a won rally (a single point) to the serve/rotation state.
//   scorer        - which team won the point
//   servingBefore - optional assertion of who served the rally start; falls
//                   back to the current serving state when omitted
export function applyRally(
  state: RallyState,
  scorer: Serving,
  servingBefore?: Serving,
): RallyOutcome {
  const wasServing = servingBefore ?? state.serving;
  if (scorer === "us" && wasServing === "them") {
    // Side-out won by us: take the serve and rotate one position.
    return { serving: "us", rotation: nextRotation(state.rotation), rotated: true };
  }
  if (scorer === "them" && wasServing === "us") {
    // They side-out off our serve: they get the serve, we don't rotate.
    return { serving: "them", rotation: state.rotation, rotated: false };
  }
  // Serving team scored: rotation holds. Honour an asserted serve state so a
  // wrong toggle gets corrected; otherwise keep what we had.
  return {
    serving: servingBefore ?? state.serving,
    rotation: state.rotation,
    rotated: false,
  };
}
