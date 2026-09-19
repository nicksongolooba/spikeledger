// Which actions the tapped player could actually have performed.
//
// The principle: gate on what the app knows for certain, never on what it
// infers. And never on a state the action itself is used to correct.
//
// That second rule is why nothing here reads the serving flag. The flag
// drifts by design - a manual score correction deliberately does not move it
// (see MatchEntry) - and recording an ace, a serve error or a pass is how the
// app puts it right (see servingAssertionFor in rotation.ts). Gating those
// actions on the flag meant a wrong flag disabled the only thing that could
// fix it, and the state stayed wrong. So availability depends on the lineup
// alone, which is reliable: the on-court array is rotated in lockstep with
// the rotation number.
//
// It also does NOT know whether the current rally is in serve receive or in
// transition, so nothing here is gated on rally phase. A wrong guess there
// stops a coach recording something that happened, which is worse than
// showing a button they will not press.
//
// Two rules that look like the same idea and are wrong, so they are not here:
//   - back row players keep every attack button. A back row attack from behind
//     the three metre line is legal, and the pipe is a normal play from 14U.
//   - middles and setters keep serve receive. They rarely pass, and rarely is
//     not never.

import type { StatActionId } from "@/lib/stat-actions";

export interface CourtContext {
  // 1 to 6, or null when the app does not know where the player is standing.
  // Unknown means show everything: never gate on a fact we do not have.
  slot: number | null;
  isLibero: boolean;
}

export type UnavailableReason = "not-serve-slot" | "back-row" | "libero-block";

export type Availability =
  | { available: true }
  | { available: false; reason: UnavailableReason };

const AVAILABLE = { available: true } as const;
const no = (reason: UnavailableReason): Availability => ({ available: false, reason });

// Slots 2, 3 and 4 are the front row, whatever the team calls its positions.
export function isFrontRow(slot: number | null): boolean {
  return slot === 2 || slot === 3 || slot === 4;
}

export function actionAvailability(id: StatActionId, ctx: CourtContext): Availability {
  switch (id) {
    // Serving actions: the player in slot 1, whoever the scoreboard currently
    // thinks is serving. Recording one of these is what corrects the
    // scoreboard, so it must never depend on it.
    case "ACE":
    case "S_ERR": {
      if (ctx.slot === null) return AVAILABLE;
      if (ctx.slot !== 1) return no("not-serve-slot");
      return AVAILABLE;
    }

    // Blocking: front row only, and never a libero. Both read the lineup, not
    // the serving flag, so they stay gated. A libero attempting a block is a
    // fault wherever they are standing, so that is not a front row rule for
    // them.
    case "BLOCK":
    case "NET_ERR": {
      if (ctx.isLibero) return no("libero-block");
      if (ctx.slot === null) return AVAILABLE;
      if (!isFrontRow(ctx.slot)) return no("back-row");
      return AVAILABLE;
    }

    // Everything else is always available: serve receive from any slot, attack
    // from any slot, and the plays that keep a rally alive.
    default:
      return AVAILABLE;
  }
}

// One short line saying why a disabled button did nothing. Shown when a coach
// taps it: a button that responds to nothing at all is the same silent failure
// as the blank court was.
export function unavailableLine(
  reason: UnavailableReason,
  // The serving rule covers both Ace and Serve err, and a coach looking at
  // Serve err should not be told about aces.
  id?: StatActionId,
): string {
  switch (reason) {
    case "not-serve-slot":
      return `Only the server can record ${id === "S_ERR" ? "a serve error" : "an ace"}.`;
    case "back-row":
      return "Back row players cannot block.";
    case "libero-block":
      return "A libero cannot block.";
  }
}
