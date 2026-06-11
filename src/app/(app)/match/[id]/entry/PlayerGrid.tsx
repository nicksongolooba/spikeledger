"use client";

import { useState } from "react";
import type { Position } from "@prisma/client";
import { POSITION_GROUP, type PositionGroup } from "@/lib/positions";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { CourtFormation } from "./CourtGrid";
import type { PositionByPlayer, RosterPlayer } from "./types";

const GROUP_RING: Record<PositionGroup, string> = {
  hitter: "ring-amber-400/40",
  middle: "ring-violet-400/40",
  setter: "ring-volt-400/40",
  libero: "ring-emerald-400/40",
};

export function PlayerGrid({
  roster,
  onCourt,
  bench,
  selectedId,
  positions,
  onSelect,
  onSub,
  onOpenLineup,
  liberoActive,
  onLiberoIn,
  onLiberoOut,
}: {
  roster: RosterPlayer[];
  onCourt: string[];
  bench: string[];
  selectedId: string | null;
  positions: PositionByPlayer;
  onSelect: (playerId: string) => void;
  onSub: (benchId: string, courtId: string, position: Position) => void;
  onOpenLineup: () => void;
  liberoActive: boolean;
  onLiberoIn: (liberoId: string, courtId: string) => void;
  onLiberoOut: () => void;
}) {
  const [subFor, setSubFor] = useState<RosterPlayer | null>(null);
  // Two-step libero picker: pick which libero (only when 2+ are available),
  // then pick the on-court player they sub in for.
  const [liberoStep, setLiberoStep] = useState<"closed" | "libero" | "court">(
    "closed",
  );
  const [chosenLibero, setChosenLibero] = useState<string | null>(null);

  const playerById = (id: string) => roster.find((p) => p.id === id) ?? null;

  // A team's liberos = anyone whose primary slot is L or DS.
  const liberos = roster.filter(
    (p) => POSITION_GROUP[p.primaryPosition] === "libero",
  );
  const hasLibero = liberos.length > 0;
  // Liberos available to come in = those not already on court.
  const benchLiberos = liberos.filter((p) => !onCourt.includes(p.id));
  // Court players a libero can replace (anyone on court who isn't a libero).
  const liberoEligibleCourt = onCourt
    .map(playerById)
    .filter(
      (p): p is RosterPlayer =>
        !!p &&
        POSITION_GROUP[positions[p.id] ?? p.primaryPosition] !== "libero",
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
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          On Court ({onCourt.length}/6)
        </h3>
        <div className="flex items-center gap-3">
          {hasLibero && (
            <button
              type="button"
              onClick={handleLiberoButton}
              aria-pressed={liberoActive}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                liberoActive
                  ? "border-emerald-400 bg-emerald-400/15 text-emerald-300"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-emerald-400/50 hover:text-emerald-300",
              )}
            >
              {liberoActive ? "Libero out" : "Libero"}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenLineup}
            className="text-xs text-volt-300 hover:text-volt-200"
          >
            Edit lineup
          </button>
        </div>
      </div>

      <CourtFormation
        ordered={onCourt}
        roster={roster}
        positions={positions}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      {bench.length > 0 && (
        <>
          <div className="my-3 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-800" />
            <span className="uppercase tracking-wide">Bench</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {bench.map((id) => {
              const p = playerById(id);
              if (!p) return null;
              const pos = positions[id] ?? p.primaryPosition;
              return (
                <PlayerCard
                  key={id}
                  player={p}
                  positionPlayed={pos}
                  dim
                  selected={false}
                  onClick={() => setSubFor(p)}
                />
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
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setChosenLibero(p.id);
                  setLiberoStep("court");
                }}
                className="flex flex-col items-center rounded-lg border border-slate-800 bg-slate-900 py-2 transition-colors hover:border-emerald-400/50"
              >
                <div className="stat-number text-sm font-bold text-slate-100">
                  #{p.number ?? "-"}
                </div>
                <div className="truncate text-xs text-slate-200">{p.name}</div>
                <PositionBadge
                  position={p.primaryPosition}
                  size="xs"
                  className="mt-1"
                />
              </button>
            ))}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {liberoEligibleCourt.map((p) => {
                const pos = positions[p.id] ?? p.primaryPosition;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (chosenLibero) onLiberoIn(chosenLibero, p.id);
                      closeLiberoPicker();
                    }}
                    className="flex flex-col items-center rounded-lg border border-slate-800 bg-slate-900 py-2 transition-colors hover:border-emerald-400/50"
                  >
                    <div className="stat-number text-sm font-bold text-slate-100">
                      #{p.number ?? "-"}
                    </div>
                    <div className="truncate text-xs text-slate-200">
                      {p.name}
                    </div>
                    <PositionBadge position={pos} size="xs" className="mt-1" />
                  </button>
                );
              })}
            </div>
            {liberoEligibleCourt.length === 0 && (
              <p className="text-sm text-slate-400">
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

function PlayerCard({
  player,
  positionPlayed,
  dim,
  selected,
  onClick,
}: {
  player: RosterPlayer;
  positionPlayed: Position;
  dim: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const group = POSITION_GROUP[positionPlayed];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[64px] flex-col items-center justify-center rounded-xl border bg-slate-900 px-2 py-2 text-center transition-all active:scale-[0.98]",
        "ring-1",
        GROUP_RING[group],
        selected
          ? "border-volt-400 ring-2 ring-volt-400 shadow-[0_0_0_2px_rgba(34,211,238,0.2)]"
          : "border-slate-800",
        dim && !selected ? "opacity-50" : "",
      )}
    >
      <div className="stat-number text-base font-bold text-slate-100">
        #{player.number ?? "-"}
      </div>
      <div className="mt-0.5 truncate text-xs font-medium text-slate-200">
        {player.name}
      </div>
      <PositionBadge position={positionPlayed} size="xs" className="mt-1" />
    </button>
  );
}

function SubFor({
  benchPlayer,
  onCourtPlayers,
  positions,
  onPick,
  onCancel,
}: {
  benchPlayer: RosterPlayer;
  onCourtPlayers: RosterPlayer[];
  positions: PositionByPlayer;
  onPick: (courtId: string, position: Position) => void;
  onCancel: () => void;
}) {
  // For dual-role bench player, ask which position they're checking in as.
  const isDual = !!benchPlayer.secondaryPosition;
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
                  "flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                  chosenPos === p
                    ? "border-volt-400 bg-volt-400/10 text-volt-300"
                    : "border-slate-800 bg-slate-900 text-slate-300",
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
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id, chosenPos)}
                className="flex flex-col items-center rounded-lg border border-slate-800 bg-slate-900 py-2 transition-colors hover:border-slate-700"
              >
                <div className="stat-number text-sm font-bold text-slate-100">
                  #{p.number ?? "-"}
                </div>
                <div className="truncate text-xs text-slate-200">{p.name}</div>
                <PositionBadge position={pos} size="xs" className="mt-1" />
              </button>
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
