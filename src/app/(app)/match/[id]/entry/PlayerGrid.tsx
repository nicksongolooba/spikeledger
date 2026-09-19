"use client";

import { useState } from "react";
import type { Position } from "@prisma/client";
import { Pencil } from "lucide-react";
import { POSITION_GROUP, type PositionGroup } from "@/lib/positions";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { CourtFormation } from "./CourtGrid";
import {
  EMPTY_COURT_ACTION,
  EMPTY_COURT_BODY,
  EMPTY_COURT_HEADLINE,
} from "@/lib/match-state";
import type { PositionByPlayer, RosterPlayer } from "./types";

// Subtle position-group tint on each tile's ring, matching PositionBadge.
const GROUP_RING: Record<PositionGroup, string> = {
  pin_hitter: "ring-navy-200",
  middle_blocker: "ring-sky-200",
  setter: "ring-cyan-200",
  libero_ds: "ring-green-200",
};

export function PlayerGrid({
  roster,
  usesPositions = true,
  onCourt,
  bench,
  selectedId,
  positions,
  onSelect,
  onSub,
  onSwap,
  onOpenLineup,
  liberoActive,
  onLiberoIn,
  onLiberoOut,
}: {
  roster: RosterPlayer[];
  usesPositions?: boolean;
  onCourt: string[];
  bench: string[];
  selectedId: string | null;
  positions: PositionByPlayer;
  onSelect: (playerId: string) => void;
  onSub: (benchId: string, courtId: string, position: Position) => void;
  onSwap: (aId: string, bId: string) => void;
  onOpenLineup: () => void;
  liberoActive: boolean;
  onLiberoIn: (liberoId: string, courtId: string) => void;
  onLiberoOut: () => void;
}) {
  const [subFor, setSubFor] = useState<RosterPlayer | null>(null);
  // Swap mode. A bare tap on the court already means "record a stat for this
  // player", so swapping is armed by an explicit control - the same shape as
  // the Libero button next to it - rather than overloading the tap.
  const [swapArmed, setSwapArmed] = useState(false);
  const [swapFirst, setSwapFirst] = useState<string | null>(null);
  // Nothing refuses silently. One line, same as the greyed action buttons.
  const [note, setNote] = useState<string | null>(null);

  function disarmSwap() {
    setSwapArmed(false);
    setSwapFirst(null);
  }

  function handleSwapPick(id: string) {
    setNote(null);
    if (!swapFirst) {
      setSwapFirst(id);
      return;
    }
    if (swapFirst === id) {
      // Tapping the same player again puts them back down.
      setSwapFirst(null);
      return;
    }
    onSwap(swapFirst, id);
    disarmSwap();
  }

  // A drag that landed on another court player. Same swap, different gesture,
  // and it does not need swap mode armed because a long press is already
  // unambiguous.
  function handleDragSwap(aId: string, bId: string) {
    setNote(null);
    onSwap(aId, bId);
    disarmSwap();
  }
  // Two-step libero picker: pick which libero (only when 2+ are available),
  // then pick the on-court player they sub in for.
  const [liberoStep, setLiberoStep] = useState<"closed" | "libero" | "court">(
    "closed",
  );
  const [chosenLibero, setChosenLibero] = useState<string | null>(null);

  const playerById = (id: string) => roster.find((p) => p.id === id) ?? null;

  // A team's liberos = anyone whose primary slot is L or DS.
  const liberos = roster.filter(
    (p) => POSITION_GROUP[p.primaryPosition] === "libero_ds",
  );
  // No libero rules on no-positions teams - everyone is just a player.
  const hasLibero = usesPositions && liberos.length > 0;
  const neutral = !usesPositions;
  // Liberos available to come in = those not already on court.
  const benchLiberos = liberos.filter((p) => !onCourt.includes(p.id));
  // Court players a libero can replace (anyone on court who isn't a libero).
  const liberoEligibleCourt = onCourt
    .map(playerById)
    .filter(
      (p): p is RosterPlayer =>
        !!p &&
        POSITION_GROUP[positions[p.id] ?? p.primaryPosition] !== "libero_ds",
    );

  function handleLiberoButton() {
    if (liberoActive) {
      onLiberoOut();
      return;
    }
    if (benchLiberos.length === 0) return; // nobody to bring in
    if (benchLiberos.length === 1) {
      setChosenLibero(benchLiberos[0].id);
      setLiberoStep("court");
    } else {
      setChosenLibero(null);
      setLiberoStep("libero");
    }
  }

  function closeLiberoPicker() {
    setLiberoStep("closed");
    setChosenLibero(null);
  }

  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        {/* A count is the right information in the wrong form when the count
            is zero. Six of six is worth showing; none of six needs a
            sentence, and the block below carries it. */}
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-slate-700">
          On court
          {onCourt.length > 0 && (
            <span className="stat-number ml-1 text-slate-500">({onCourt.length}/6)</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {onCourt.length > 1 && (
            <button
              type="button"
              data-swap-toggle="1"
              onClick={() => {
                setNote(null);
                if (swapArmed) disarmSwap();
                else setSwapArmed(true);
              }}
              aria-pressed={swapArmed}
              className={cn(
                "min-h-[36px] rounded-full border px-3 font-display text-xs font-bold uppercase tracking-wide transition-colors",
                swapArmed
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-cyan-500 hover:text-cyan-700",
              )}
            >
              {swapArmed ? "Cancel swap" : "Swap"}
            </button>
          )}
          {hasLibero && (
            <button
              type="button"
              onClick={handleLiberoButton}
              aria-pressed={liberoActive}
              className={cn(
                "min-h-[36px] rounded-full border px-3 font-display text-xs font-bold uppercase tracking-wide transition-colors",
                liberoActive
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-green-500 hover:text-green-700",
              )}
            >
              {liberoActive ? "Libero out" : "Libero"}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenLineup}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-cyan-700 hover:text-cyan-800"
          >
            <Pencil size={14} strokeWidth={2} aria-hidden />
            Edit lineup
          </button>
        </div>
      </div>

      {/* Permanent guard. The court must never render empty and silent, so if
          it ever has nobody on it the page says so and offers the way out.
          The page-level no-lineup state should mean this is unreachable,
          which is exactly why it is worth keeping. */}
      {onCourt.length === 0 ? (
        <div
          data-empty-court="1"
          className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-center"
        >
          <p className="font-semibold text-amber-900">{EMPTY_COURT_HEADLINE}</p>
          <p className="mt-1 text-sm text-amber-800">{EMPTY_COURT_BODY}</p>
          <button type="button" onClick={onOpenLineup} className="btn-primary mt-4">
            {EMPTY_COURT_ACTION}
          </button>
        </div>
      ) : (
      <CourtFormation
        ordered={onCourt}
        roster={roster}
        positions={positions}
        selectedId={selectedId}
        onSelect={onSelect}
        neutral={neutral}
        swapArmed={swapArmed}
        swapFirstId={swapFirst}
        onSwapPick={handleSwapPick}
        onSwap={handleDragSwap}
        onSwapRefused={setNote}
      />
      )}

      {/* Swap mode says what it wants, and every refusal says why. Fixed
          height so arming the mode never shifts the court above it. */}
      {(swapArmed || note) && onCourt.length > 0 && (
        <p
          data-swap-note="1"
          aria-live="polite"
          className="mt-2 min-h-[20px] text-sm text-slate-600"
        >
          {note
            ? note
            : swapFirst
              ? `${playerById(swapFirst)?.name ?? "Player"} picked up. Tap who they change places with, or tap them again to put them back.`
              : "Tap two players on court to change their places."}
        </p>
      )}

      {bench.length > 0 && (
        <>
          <div className="my-3 flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
            <span className="h-px flex-1 bg-slate-200" />
            <span>Bench · tap to sub</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {bench.map((id) => {
              const p = playerById(id);
              if (!p) return null;
              const pos = positions[id] ?? p.primaryPosition;
              return (
                <div key={id} data-bench-tile={id}>
                  <PlayerCard
                    player={p}
                    positionPlayed={pos}
                    dim
                    selected={false}
                    neutral={neutral}
                    onClick={() => {
                      // Correction and substitution are different actions and
                      // must not share a gesture. Refused with a reason, and
                      // the sub flow is one tap away once swap is cancelled.
                      if (swapArmed) {
                        setNote(
                          `${p.name} is on the bench. Swapping changes places between two players already on court - cancel the swap to sub them in.`,
                        );
                        return;
                      }
                      setSubFor(p);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={!!subFor}
        onClose={() => setSubFor(null)}
        title={subFor ? `Sub ${subFor.name} in for...` : "Sub"}
      >
        {subFor && (
          <SubFor
            benchPlayer={subFor}
            usesPositions={usesPositions}
            onCourtPlayers={onCourt
              .map(playerById)
              .filter((p): p is RosterPlayer => !!p)}
            positions={positions}
            onPick={(courtId, position) => {
              onSub(subFor.id, courtId, position);
              setSubFor(null);
            }}
            onCancel={() => setSubFor(null)}
          />
        )}
      </Modal>

      <Modal
        open={liberoStep !== "closed"}
        onClose={closeLiberoPicker}
        title={liberoStep === "libero" ? "Which libero?" : "Libero in for who?"}
      >
        {liberoStep === "libero" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {benchLiberos.map((p) => (
              <PickTile
                key={p.id}
                player={p}
                positionPlayed={p.primaryPosition}
                onClick={() => {
                  setChosenLibero(p.id);
                  setLiberoStep("court");
                }}
              />
            ))}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {liberoEligibleCourt.map((p) => {
                const pos = positions[p.id] ?? p.primaryPosition;
                return (
                  <PickTile
                    key={p.id}
                    player={p}
                    positionPlayed={pos}
                    onClick={() => {
                      if (chosenLibero) onLiberoIn(chosenLibero, p.id);
                      closeLiberoPicker();
                    }}
                  />
                );
              })}
            </div>
            {liberoEligibleCourt.length === 0 && (
              <p className="text-sm text-slate-600">
                No eligible court players to replace.
              </p>
            )}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={closeLiberoPicker}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}

// Compact pick tile used inside the sub / libero modals.
function PickTile({
  player,
  positionPlayed,
  onClick,
  neutral = false,
}: {
  player: RosterPlayer;
  positionPlayed: Position;
  onClick: () => void;
  neutral?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[72px] flex-col items-center justify-center rounded-md border-2 border-slate-200 bg-white py-2 transition-colors hover:border-cyan-500 active:bg-cyan-50"
    >
      <div className="stat-number text-lg font-bold leading-none text-slate-900">
        #{player.number ?? "-"}
      </div>
      <div className="mt-1 max-w-full truncate px-1 text-xs font-semibold text-slate-700">
        {player.name}
      </div>
      <PositionBadge position={positionPlayed} size="xs" className="mt-1" neutral={neutral} />
    </button>
  );
}

function PlayerCard({
  player,
  positionPlayed,
  dim,
  selected,
  onClick,
  neutral = false,
}: {
  player: RosterPlayer;
  positionPlayed: Position;
  dim: boolean;
  selected: boolean;
  onClick: () => void;
  neutral?: boolean;
}) {
  const group = POSITION_GROUP[positionPlayed];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[64px] flex-col items-center justify-center rounded-md border-2 bg-white px-2 py-2 text-center transition-all active:scale-[0.98]",
        "ring-1",
        neutral ? "ring-slate-200" : GROUP_RING[group],
        selected
          ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500"
          : "border-slate-200",
        dim && !selected ? "opacity-70" : "",
      )}
    >
      <div className="stat-number text-lg font-bold leading-none text-slate-900">
        #{player.number ?? "-"}
      </div>
      <div className="mt-1 max-w-full truncate text-xs font-semibold text-slate-700">
        {player.name}
      </div>
      <PositionBadge position={positionPlayed} size="xs" className="mt-1" neutral={neutral} />
    </button>
  );
}

function SubFor({
  benchPlayer,
  usesPositions,
  onCourtPlayers,
  positions,
  onPick,
  onCancel,
}: {
  benchPlayer: RosterPlayer;
  usesPositions: boolean;
  onCourtPlayers: RosterPlayer[];
  positions: PositionByPlayer;
  onPick: (courtId: string, position: Position) => void;
  onCancel: () => void;
}) {
  // For dual-role bench player, ask which position they're checking in as.
  const isDual = usesPositions && !!benchPlayer.secondaryPosition;
  const positionChoices: Position[] = isDual
    ? [benchPlayer.primaryPosition, benchPlayer.secondaryPosition!]
    : [benchPlayer.primaryPosition];
  const [chosenPos, setChosenPos] = useState<Position>(positionChoices[0]);

  return (
    <div className="space-y-3">
      {isDual && (
        <div>
          <label className="label">Playing as:</label>
          <div className="flex gap-2">
            {positionChoices.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setChosenPos(p)}
                className={cn(
                  "min-h-[44px] flex-1 rounded-md border-2 px-3 py-2 font-display text-base font-bold uppercase tracking-wide transition-colors",
                  chosenPos === p
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="label">Swap with on-court player:</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {onCourtPlayers.map((p) => {
            const pos = positions[p.id] ?? p.primaryPosition;
            return (
              <PickTile
                key={p.id}
                player={p}
                positionPlayed={pos}
                neutral={!usesPositions}
                onClick={() => onPick(p.id, chosenPos)}
              />
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
