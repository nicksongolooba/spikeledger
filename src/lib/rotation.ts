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

// The on-court lineup is stored as an array where index i holds the player at
// court position i+1 (index 0 = position 1, the back-right serve slot). A
// clockwise rotation - what a won side-out triggers - moves every player one
// position lower: P2->P1, P3->P2, P4->P3, P5->P4, P6->P5, P1->P6. In array
// terms that is a left-shift. dir = -1 reverses it for a manual correction.
export function rotateLineup<T>(onCourt: T[], dir: 1 | -1 = 1): T[] {
  if (onCourt.length !== 6) return onCourt.slice();
  return dir === 1
    ? [...onCourt.slice(1), onCourt[0]]
    : [onCourt[onCourt.length - 1], ...onCourt.slice(0, -1)];
}

// Some actions are proof of who served, regardless of what the toggle said.
// An ace or a serve error can only happen on our serve. A serve receive can
// only happen against theirs. Returning a value here lets the caller correct
// a wrong toggle without faking a rotation.
//
// Anything this returns a value for must never be gated on the serving state:
// it is the repair, so blocking it on the thing it repairs leaves the state
// stuck wrong. See action-availability.ts.
export function servingAssertionFor(action: StatActionId): Serving | undefined {
  if (action === "ACE" || action === "S_ERR") return "us";
  if (action === "SR_0" || action === "SR_1" || action === "SR_2" || action === "SR_3") {
    return "them";
  }
  return undefined;
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
