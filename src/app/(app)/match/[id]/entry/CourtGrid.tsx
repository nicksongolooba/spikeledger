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

const GROUP_RING: Record<PositionGroup, string> = {
  hitter: "ring-amber-400/40",
  middle: "ring-violet-400/40",
  setter: "ring-cyan-400/40",
  libero: "ring-emerald-400/40",
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
}: {
  // ordered[i] is the player id at court position i+1 (index 0 = position 1).
  ordered: (string | undefined)[];
  roster: RosterPlayer[];
  positions: PositionByPlayer;
  selectedId?: string | null;
  onSelect?: (playerId: string) => void;
  compact?: boolean;
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
      <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700" />
        Net
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700" />
      </div>
      <div
        className={cn(
          "relative w-full rounded-xl border border-slate-800 bg-slate-950/40",
          compact ? "h-36" : "h-48 sm:h-56",
        )}
      >
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
  onClick,
}: {
  player: RosterPlayer;
  positionPlayed: Position;
  courtPos: number;
  isServer: boolean;
  selected: boolean;
  interactive: boolean;
  compact: boolean;
  onClick?: () => void;
}) {
  const group = POSITION_GROUP[positionPlayed];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center rounded-lg border bg-slate-900 px-1 text-center transition-all",
        interactive && "active:scale-[0.97]",
        "ring-1",
        GROUP_RING[group],
        selected
          ? "border-cyan-400 ring-2 ring-cyan-400 shadow-[0_0_0_2px_rgba(34,211,238,0.25)]"
          : isServer
            ? "border-amber-400/80"
            : "border-slate-800",
      )}
    >
      {/* Court position number, top-left */}
      <span className="absolute left-1 top-0.5 stat-number text-[9px] font-bold text-slate-600">
        {courtPos}
      </span>
      {/* Server badge, top-right */}
      {isServer && (
        <span className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded bg-amber-400 px-1 text-[8px] font-bold uppercase tracking-wide text-amber-950">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-2 w-2">
            <circle cx="12" cy="12" r="9" />
          </svg>
          Srv
        </span>
      )}
      <div
        className={cn(
          "stat-number font-bold text-slate-100",
          compact ? "text-sm" : "text-base",
        )}
      >
        #{player.number ?? "-"}
      </div>
      {!compact && (
        <div className="mt-0.5 max-w-full truncate px-1 text-xs font-medium text-slate-200">
          {player.name}
        </div>
      )}
      <PositionBadge position={positionPlayed} size="xs" className="mt-0.5" />
    </button>
  );
}
