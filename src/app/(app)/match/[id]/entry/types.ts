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

export interface UndoEntry {
  id: string;          // wal entry id, used to expand into the WAL on undo
  playerId: string;
  playerName: string;
  action: StatActionId;
  ts: number;
}

export interface SetScore {
  us: number;
  them: number;
}
