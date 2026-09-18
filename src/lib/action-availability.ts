// Which actions the tapped player could actually have performed.
//
// The principle: gate on what the app knows for certain, never on what it
// infers. It knows who is in which slot, who the libero is, and which team is
// serving. Those are facts about the state of the court.
//
// It does NOT know whether the current rally is in serve receive or in
// transition, so nothing here is gated on rally phase. A wrong guess there
// stops a coach recording something that happened, which is worse than showing
// a button they will not press.
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
  serving: "us" | "them";
  isLibero: boolean;
}

export type UnavailableReason =
  | "not-serve-slot"
  | "opponent-serving"
  | "back-row"
  | "libero-block"
  | "we-are-serving";

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
    // Serving actions: only the player in slot 1, and only while we serve.
    case "ACE":
    case "S_ERR": {
      if (ctx.slot === null) return AVAILABLE;
      if (ctx.serving !== "us") return no("opponent-serving");
      if (ctx.slot !== 1) return no("not-serve-slot");
      return AVAILABLE;
    }

    // Blocking: front row only, and never a libero. A libero attempting a
    // block is a fault wherever they are standing, so that is not a front row
    // rule for them.
    case "BLOCK":
    case "NET_ERR": {
      if (ctx.isLibero) return no("libero-block");
      if (ctx.slot === null) return AVAILABLE;
      if (!isFrontRow(ctx.slot)) return no("back-row");
      return AVAILABLE;
    }

    // Serve receive: there is nothing to receive while we are serving.
    case "SR_0":
    case "SR_1":
    case "SR_2":
    case "SR_3":
      return ctx.serving === "us" ? no("we-are-serving") : AVAILABLE;

    // Everything else is always available: attack from any slot, and the
    // plays that keep a rally alive.
    default:
      return AVAILABLE;
  }
}

// One short line saying why a disabled button did nothing. Shown when a coach
// taps it: a button that responds to nothing at all is the same silent failure
// as the blank court was.
export function unavailableLine(
  reason: UnavailableReason,
  // The serving rules cover both Ace and Serve err, and a coach looking at
  // Serve err should not be told about aces.
  id?: StatActionId,
): string {
  const serveThing = id === "S_ERR" ? "a serve error" : "an ace";
  switch (reason) {
    case "not-serve-slot":
      return `Only the server can record ${serveThing}.`;
    case "opponent-serving":
      return `The scoreboard says the other team is serving, so nobody can record ${serveThing}.`;
    case "back-row":
      return "Back row players cannot block.";
    case "libero-block":
      return "A libero cannot block.";
    case "we-are-serving":
      return "Serve receive only applies when the other team is serving.";
  }
}
