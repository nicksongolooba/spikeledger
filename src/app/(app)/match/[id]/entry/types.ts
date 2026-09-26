import type { Position } from "@prisma/client";
import type { StatActionId } from "@/lib/stat-actions";

export interface RosterPlayer {
  id: string;
  name: string;
  number: number | null;
  primaryPosition: Position;
  secondaryPosition: Position | null;
}

// Tracks which position a player is playing for THIS match. Locked in at
// lineup time. Dual-role players (Jordan, Sam) have a real choice; everyone
// else inherits their primaryPosition.
export type PositionByPlayer = Record<string, Position>;

// A player's stat, or the Opp error button (a point for us credited to nobody).
export type UndoAction = StatActionId | "OPP_ERR";

export interface UndoEntry {
  id: string;          // wal entry id, used to expand into the WAL on undo
  playerId: string;    // "" for Opp error
  playerName: string;  // "" for Opp error
  action: UndoAction;
  ts: number;
  // What the action did, so undo can reverse exactly that. Absent on entries
  // saved before undo reversed points; those only remove the stat.
  setIdx?: number;
  point?: "us" | "them" | null;   // who the action gave a point to, if anyone
  servingBefore?: "us" | "them";
  servingAfter?: "us" | "them";
  rotated?: boolean;              // the point was a side-out that rotated us
  inPlay?: number;                // the set being played when it happened
}

export interface SetScore {
  us: number;
  them: number;
}

// Tracks an active libero substitution made via the quick LIB button, so one
// tap can swap the replaced player back in (the libero comes out every time
// they rotate to the front row).
export interface LiberoSwap {
  liberoId: string;
  replacedId: string;
  replacedPosition: Position;
}
