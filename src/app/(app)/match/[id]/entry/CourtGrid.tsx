"use client";

import { useEffect, useRef, useState } from "react";
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
  pin_hitter: "ring-navy-200",
  middle_blocker: "ring-sky-200",
  setter: "ring-cyan-200",
  libero_ds: "ring-green-200",
};

// Long press to pick a player up, drag, drop on another to swap.
//
// Pointer events, not HTML5 drag and drop, which does not fire on touch
// devices at all - and this is a phone-first page used courtside. A long
// press rather than a plain drag so the gesture cannot be confused with a
// tap (which records a stat) or with scrolling the page.
//
// The court scrolls like the rest of the page: a swipe that starts on a
// player must still scroll. Only once a long press has picked a player up
// does the page hold still, by cancelling touchmove (see the effect below).
const LONG_PRESS_MS = 350;
const SLOP_PX = 10;

interface DragState {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  over: string | null;
}

function useDragToSwap({
  onSwap,
  onSwapRefused,
  enabled,
}: {
  onSwap?: (aId: string, bId: string) => void;
  onSwapRefused?: (reason: string) => void;
  enabled: boolean;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ id: string; x: number; y: number } | null>(null);
  // True from the moment a long press picks a player up until the drop. A
  // ref, not the drag state, because the touchmove listener has to see it on
  // the very next event, before React has re-rendered.
  const lifted = useRef(false);
  const courtRef = useRef<HTMLDivElement | null>(null);

  // While a player is picked up, cancel touchmove so the browser never starts
  // a scroll (which would also end the drag with pointercancel). Before the
  // pick-up nothing is cancelled, so a swipe scrolls. A native listener:
  // React's touch listeners are passive and cannot cancel.
  useEffect(() => {
    const el = courtRef.current;
    if (!el || !enabled) return;
    const onTouchMove = (e: TouchEvent) => {
      if (lifted.current && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [enabled]);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  // What is under the pointer. The dragged card is pointer-events:none while
  // it is in the air, so it never hit-tests against itself.
  function targetAt(x: number, y: number) {
    if (typeof document === "undefined") return { court: null as string | null, bench: false };
    const stack = document.elementsFromPoint(x, y);
    let court: string | null = null;
    let bench = false;
    for (const el of stack) {
      const slot = el.closest?.("[data-court-slot]");
      if (slot && !court) court = slot.getAttribute("data-court-slot");
      if (el.closest?.("[data-bench-tile]")) bench = true;
    }
    return { court, bench };
  }

  function onPointerDown(id: string, e: React.PointerEvent) {
    if (!enabled) return;
    start.current = { id, x: e.clientX, y: e.clientY };
    const el = e.currentTarget as HTMLElement;
    clearTimer();
    timer.current = setTimeout(() => {
      // Picked up. Capture so the drag survives the pointer leaving the card.
      lifted.current = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* not captureable */ }
      setDrag({ id, x: e.clientX, y: e.clientY, dx: 0, dy: 0, over: null });
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!enabled) return;
    if (!drag) {
      // Moving before the press completes means a scroll, not a pick-up.
      const s = start.current;
      if (s && (Math.abs(e.clientX - s.x) > SLOP_PX || Math.abs(e.clientY - s.y) > SLOP_PX)) {
        clearTimer();
        start.current = null;
      }
      return;
    }
    e.preventDefault();
    const { court } = targetAt(e.clientX, e.clientY);
    setDrag((d) =>
      d ? { ...d, dx: e.clientX - d.x, dy: e.clientY - d.y, over: court && court !== d.id ? court : null } : d,
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    clearTimer();
    lifted.current = false;
    if (!drag) { start.current = null; return; }
    const picked = drag.id;
    const { court, bench } = targetAt(e.clientX, e.clientY);
    setDrag(null);
    start.current = null;
    if (court && court !== picked) {
      onSwap?.(picked, court);
      return;
    }
    // Every refusal says why. Substitution is a different action with a
    // different meaning, so a bench drop is never quietly treated as a swap.
    if (bench) {
      onSwapRefused?.("Dragging onto the bench does not substitute. Tap a bench player to sub them in.");
      return;
    }
    if (!court) onSwapRefused?.("Dropped outside the court, so nothing moved.");
  }

  function onPointerCancel() {
    clearTimer();
    lifted.current = false;
    start.current = null;
    setDrag(null);
  }

  return { drag, courtRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

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
  swapArmed = false,
  swapFirstId = null,
  onSwapPick,
  onSwap,
  onSwapRefused,
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
  // Swap mode: taps pick two players to trade slots instead of selecting one
  // to record a stat. Armed by an explicit control, never by a bare tap,
  // because a bare tap on the court already means something.
  swapArmed?: boolean;
  swapFirstId?: string | null;
  onSwapPick?: (playerId: string) => void;
  onSwap?: (aId: string, bId: string) => void;
  onSwapRefused?: (reason: string) => void;
}) {
  const playerById = (id: string) => roster.find((p) => p.id === id) ?? null;
  const drag = useDragToSwap({ onSwap, onSwapRefused, enabled: !!onSwap });
  const dragging = drag.drag?.id ?? null;

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
        ref={drag.courtRef}
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
              data-court-slot={id}
              className={cn("absolute p-1", dragging === id && "z-20")}
              style={{
                left: `${(col / 3) * 100}%`,
                top: `${row * 50}%`,
                width: `${100 / 3}%`,
                height: "50%",
                // The lifted card follows the pointer instead of animating,
                // or it would lag behind the finger by the transition time.
                transform:
                  dragging === id ? `translate(${drag.drag!.dx}px, ${drag.drag!.dy}px)` : undefined,
                transition:
                  dragging === id
                    ? "none"
                    : "left 450ms cubic-bezier(0.4,0,0.2,1), top 450ms cubic-bezier(0.4,0,0.2,1)",
                // Never hit-test against itself while in the air.
                pointerEvents: dragging === id ? "none" : undefined,
              }}
            >
              <CourtCard
                player={p}
                positionPlayed={pos}
                courtPos={courtPos}
                isServer={courtPos === 1}
                selected={selectedId === id}
                interactive={!!onSelect || swapArmed}
                compact={compact}
                neutral={neutral}
                picked={swapFirstId === id || dragging === id}
                target={drag.drag?.over === id || (swapArmed && !!swapFirstId && swapFirstId !== id)}
                onPointerDown={(e) => drag.onPointerDown(id, e)}
                onPointerMove={drag.onPointerMove}
                onPointerUp={drag.onPointerUp}
                onPointerCancel={drag.onPointerCancel}
                onClick={
                  swapArmed
                    ? () => onSwapPick?.(id)
                    : onSelect
                      ? () => onSelect(id)
                      : undefined
                }
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
  picked = false,
  target = false,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  player: RosterPlayer;
  positionPlayed: Position;
  courtPos: number;
  isServer: boolean;
  selected: boolean;
  interactive: boolean;
  compact: boolean;
  neutral: boolean;
  // Lifted for a swap: either tapped first in swap mode, or in the air.
  picked?: boolean;
  // A place this player could be dropped.
  target?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: () => void;
}) {
  const group = POSITION_GROUP[positionPlayed];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      data-court-card={player.id}
      data-picked={picked ? "1" : undefined}
      data-target={target ? "1" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // A long press on a phone is also the browser's own gesture: text
      // selection, the iOS callout, the Android context menu. Chrome fires
      // pointercancel when it claims the press, which killed the pick-up
      // before it started. Declining all three keeps the press ours.
      // Panning stays allowed ("manipulation" only drops double-tap zoom), so
      // a swipe that starts here scrolls; useDragToSwap holds the page still
      // once a player is picked up.
      onContextMenu={onPointerDown ? (e) => e.preventDefault() : undefined}
      style={
        onPointerDown
          ? {
              touchAction: "manipulation",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }
          : undefined
      }
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center rounded-md border-2 bg-white px-1 text-center transition-all",
        interactive && !picked && "active:scale-[0.97]",
        "ring-1",
        neutral ? "ring-slate-200" : GROUP_RING[group],
        picked
          ? "scale-105 border-cyan-600 bg-cyan-50 shadow-lg ring-2 ring-cyan-600"
          : target
            ? "border-dashed border-cyan-400 ring-2 ring-cyan-200"
            : selected
              ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500"
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
