"use client";

import { useEffect, useMemo, useState } from "react";
import type { Position } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { POSITION_LABELS } from "@/lib/positions";
import { cn } from "@/lib/utils";
import { CourtFormation } from "./CourtGrid";
import type { PositionByPlayer, RosterPlayer } from "./types";

const COURT_SIZE = 6;

export function LineupModal({
  open,
  roster,
  usesPositions = true,
  initialOnCourt,
  initialPositions,
  onClose,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  roster: RosterPlayer[];
  usesPositions?: boolean;
  initialOnCourt: string[];
  initialPositions: PositionByPlayer;
  // Escape and the backdrop. Dismissing in place lands on the no-lineup empty
  // state, which has one obvious action on it.
  onClose: () => void;
  // The Cancel button, for a coach who opened the wrong match and wants out of
  // it rather than into a blank version of it.
  onCancel: () => void;
  onConfirm: (
    onCourt: string[],
    positionsByPlayer: PositionByPlayer,
  ) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<string[]>(initialOnCourt);
  const [positions, setPositions] =
    useState<PositionByPlayer>(initialPositions);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sync incoming defaults when the modal is reopened.
  useEffect(() => {
    if (open) {
      setSelected(initialOnCourt);
      setPositions(initialPositions);
      setError(null);
    }
  }, [open, initialOnCourt, initialPositions]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function togglePlayer(playerId: string) {
    setError(null);
    if (selectedSet.has(playerId)) {
      setSelected(selected.filter((id) => id !== playerId));
      return;
    }
    if (selected.length >= COURT_SIZE) {
      setError(`You can only start ${COURT_SIZE} players.`);
      return;
    }
    setSelected([...selected, playerId]);
  }

  function setPositionFor(playerId: string, pos: Position) {
    setPositions({ ...positions, [playerId]: pos });
  }

  async function confirm() {
    setError(null);
    if (selected.length !== COURT_SIZE) {
      setError(`Pick exactly ${COURT_SIZE} starters (you have ${selected.length}).`);
      return;
    }
    // Every selected player must have a position; default to primary if missing.
    const finalPositions: PositionByPlayer = { ...positions };
    for (const id of selected) {
      if (!finalPositions[id]) {
        const player = roster.find((p) => p.id === id);
        if (player) finalPositions[id] = player.primaryPosition;
      }
    }
    setBusy(true);
    try {
      await onConfirm(selected, finalPositions);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set starting lineup"
      className="max-w-2xl"
    >
      <p className="mb-4 text-sm text-slate-600">
        Tap players in rotation order. The first player tapped is the server
        (position 1, back-right); the rest fill 2-6 clockwise.
        {usesPositions
          ? " Dual-role players will ask which position they're playing this match."
          : " No set positions on this team - everyone rotates through every spot."}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {roster.map((p) => {
          const isSelected = selectedSet.has(p.id);
          const isDual = usesPositions && !!p.secondaryPosition;
          const chosen = positions[p.id] ?? p.primaryPosition;
          const isServer = isSelected && selected[0] === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlayer(p.id)}
              className={cn(
                "flex min-h-[56px] items-center gap-3 rounded-md border-2 p-2.5 text-left transition-colors",
                isSelected
                  ? "border-cyan-500 bg-cyan-50"
                  : "border-slate-200 bg-white hover:border-slate-400",
              )}
            >
              <div className="stat-number flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-base font-bold text-slate-900">
                {p.number ?? "-"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {p.name}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <PositionBadge position={p.primaryPosition} size="xs" neutral={!usesPositions} />
                  {usesPositions && p.secondaryPosition && (
                    <PositionBadge position={p.secondaryPosition} size="xs" />
                  )}
                </div>
              </div>
              {isSelected && (
                <span
                  className={cn(
                    "stat-number flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    isServer ? "bg-cyan-500 text-navy-950" : "bg-navy-900 text-white",
                  )}
                  title={
                    isServer
                      ? "Position 1 - server"
                      : `Position ${selected.indexOf(p.id) + 1}`
                  }
                >
                  {selected.indexOf(p.id) + 1}
                </span>
              )}
              {isDual && isSelected && (
                <select
                  value={chosen}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setPositionFor(p.id, e.target.value as Position)
                  }
                  className="ml-auto rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-800"
                >
                  {[p.primaryPosition, p.secondaryPosition!].map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-600">
          <span className="stat-number text-base font-bold text-slate-900">
            {selected.length} / {COURT_SIZE}
          </span>{" "}
          selected
        </span>
        {error && <span className="font-medium text-red-700">{error}</span>}
      </div>

      {selected.length === 6 && (
        <div className="mt-4">
          <div className="eyebrow mb-1 text-slate-500">Starting formation</div>
          <CourtFormation
            ordered={selected}
            roster={roster}
            positions={positions}
            compact
            neutral={!usesPositions}
          />
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="eyebrow mb-2 text-slate-500">Rotation order</div>
          <div className="space-y-1.5">
            {selected.map((id, i) => {
              const p = roster.find((rp) => rp.id === id);
              if (!p) return null;
              const pos = positions[id] ?? p.primaryPosition;
              return (
                <div key={id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-800">
                    <span
                      className={cn(
                        "stat-number flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                        i === 0
                          ? "bg-cyan-500 text-navy-950"
                          : "bg-slate-200 text-slate-700",
                      )}
                    >
                      {i + 1}
                    </span>
                    {p.name}{" "}
                    <span className="text-slate-500">#{p.number ?? "-"}</span>
                    {i === 0 && (
                      <span className="rounded bg-cyan-100 px-1 font-display text-[10px] font-bold uppercase tracking-wide text-cyan-800">
                        Server
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-slate-500">
                    {usesPositions ? POSITION_LABELS[pos] : "Player"}
                    <PositionBadge position={pos} size="xs" neutral={!usesPositions} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Leave match
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy || selected.length !== COURT_SIZE}
          className="btn-primary"
        >
          {busy ? "Saving…" : "Start match"}
        </button>
      </div>
    </Modal>
  );
}
