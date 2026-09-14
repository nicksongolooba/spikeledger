"use client";

import type { Position } from "@prisma/client";
import { POSITION_GROUP, type PositionGroup } from "@/lib/positions";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { cn } from "@/lib/utils";
import type { PositionByPlayer, RosterPlayer } from "./types";

// Court positions 1-6 mapped to a 3-col x 2-row grid as the COACH sees it,
// net at the top. Front row (positions 4-3-2) on top, back row (5-6-1) below.
// Position 1 (back-right) is the serve slot.
//   front:  P4 | P3 | P2
//   back:   P5 | P6 | P1*
const COURT_LAYOUT: Record<number, { col: 0 | 1 | 2; row: 0 | 1 }> = {
  1: { col: 2, row: 1 },
  2: { col: 2, row: 0 },
  3: { col: 1, row: 0 },
  4: { col: 0, row: 0 },
  5: { col: 0, row: 1 },
  6: { col: 1, row: 1 },
};

// Subtle position-group tint on each tile's ring, matching PositionBadge.
const GROUP_RING: Record<PositionGroup, string> = {
  hitter: "ring-navy-200",
  middle: "ring-sky-200",
  setter: "ring-orange-200",
  libero: "ring-emerald-200",
};

// Renders the six on-court players in real volleyball formation. Each card is
// absolutely placed by its court position and transitions when that position
// changes, so a side-out visibly slides everyone one spot clockwise.
export function CourtFormation({
  ordered,
  roster,
  positions,
  selectedId,
  onSelect,
  compact = false,
  neutral = false,
}: {
  // ordered[i] is the player id at court position i+1 (index 0 = position 1).
  ordered: (string | undefined)[];
  roster: RosterPlayer[];
  positions: PositionByPlayer;
  selectedId?: string | null;
  onSelect?: (playerId: string) => void;
  compact?: boolean;
  // No-positions teams: plain "Player" chips, no position-group tint.
  neutral?: boolean;
}) {
  const playerById = (id: string) => roster.find((p) => p.id === id) ?? null;

  // Render in a STABLE id order so the DOM nodes never reorder - only their
  // left/top change, which is what the CSS transition animates.
  const slots = ordered
    .slice(0, 6)
    .map((id, i) => ({ id, courtPos: i + 1 }))
    .filter((s): s is { id: string; courtPos: number } => !!s.id)
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
        <span className="h-0.5 flex-1 bg-slate-300" />
        Net
        <span className="h-0.5 flex-1 bg-slate-300" />
      </div>
      <div
        className={cn(
          "relative w-full rounded-lg border border-slate-200 bg-slate-50",
          compact ? "h-36" : "h-52 sm:h-60",
        )}
      >
        {/* Attack line (3 m line) between front and back row */}
        <div className="pointer-events-none absolute inset-x-2 top-1/2 border-t border-dashed border-slate-300" />
        {slots.map(({ id, courtPos }) => {
          const p = playerById(id);
          if (!p) return null;
          const { col, row } = COURT_LAYOUT[courtPos];
          const pos = positions[id] ?? p.primaryPosition;
          return (
            <div
              key={id}
              className="absolute p-1"
              style={{
                left: `${(col / 3) * 100}%`,
                top: `${row * 50}%`,
                width: `${100 / 3}%`,
                height: "50%",
                transition:
                  "left 450ms cubic-bezier(0.4,0,0.2,1), top 450ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <CourtCard
                player={p}
                positionPlayed={pos}
                courtPos={courtPos}
                isServer={courtPos === 1}
                selected={selectedId === id}
                interactive={!!onSelect}
                compact={compact}
                neutral={neutral}
                onClick={onSelect ? () => onSelect(id) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CourtCard({
  player,
  positionPlayed,
  courtPos,
  isServer,
  selected,
  interactive,
  compact,
  neutral,
  onClick,
}: {
  player: RosterPlayer;
  positionPlayed: Position;
  courtPos: number;
  isServer: boolean;
  selected: boolean;
  interactive: boolean;
  compact: boolean;
  neutral: boolean;
  onClick?: () => void;
}) {
  const group = POSITION_GROUP[positionPlayed];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center rounded-md border-2 bg-white px-1 text-center transition-all",
        interactive && "active:scale-[0.97]",
        "ring-1",
        neutral ? "ring-slate-200" : GROUP_RING[group],
        selected
          ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500"
          : isServer
            ? "border-amber-400"
            : "border-slate-200",
      )}
    >
      {/* Court position number, top-left */}
      <span className="stat-number absolute left-1.5 top-0.5 text-[10px] font-bold text-slate-400">
        {courtPos}
      </span>
      {/* Server badge, top-right */}
      {isServer && (
        <span className="absolute right-1 top-1 rounded bg-amber-400 px-1 font-display text-[9px] font-bold uppercase tracking-wide text-amber-950">
          Srv
        </span>
      )}
      <div
        className={cn(
          "stat-number font-bold leading-none text-slate-900",
          compact ? "text-base" : "text-xl",
        )}
      >
        #{player.number ?? "-"}
      </div>
      {!compact && (
        <div className="mt-1 max-w-full truncate px-1 text-xs font-semibold text-slate-700">
          {player.name}
        </div>
      )}
      <PositionBadge position={positionPlayed} size="xs" className="mt-1" neutral={neutral} />
    </button>
  );
}
