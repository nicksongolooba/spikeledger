"use client";

import { useEffect, useMemo, useState } from "react";
import type { Position } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { POSITION_LABELS } from "@/lib/positions";
import type { PositionByPlayer, RosterPlayer } from "./types";

const COURT_SIZE = 6;

export function LineupModal({
  open,
  roster,
  initialOnCourt,
  initialPositions,
  onClose,
  onConfirm,
}: {
  open: boolean;
  roster: RosterPlayer[];
  initialOnCourt: string[];
  initialPositions: PositionByPlayer;
  onClose: () => void;
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
      <p className="mb-4 text-sm text-slate-400">
        Pick 6 starters. Dual-role players will ask which position they&apos;re
        playing this match.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {roster.map((p) => {
          const isSelected = selectedSet.has(p.id);
          const isDual = !!p.secondaryPosition;
          const chosen = positions[p.id] ?? p.primaryPosition;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlayer(p.id)}
              className={
                "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors " +
                (isSelected
                  ? "border-cyan-400 bg-cyan-400/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700")
              }
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800 stat-number text-sm font-bold">
                {p.number ?? "-"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-100">
                  {p.name}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <PositionBadge position={p.primaryPosition} size="xs" />
                  {p.secondaryPosition && (
                    <PositionBadge position={p.secondaryPosition} size="xs" />
                  )}
                </div>
              </div>
              {isSelected && (
                <span className="text-cyan-300">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
              {isDual && isSelected && (
                <select
                  value={chosen}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setPositionFor(p.id, e.target.value as Position)
                  }
                  className="ml-auto rounded-md border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-xs"
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
        <span className="text-slate-400">
          {selected.length} / {COURT_SIZE} selected
        </span>
        {error && <span className="text-red-300">{error}</span>}
      </div>

      {selected.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
          <div className="mb-2 font-semibold uppercase tracking-wide text-slate-400">
            This match they play:
          </div>
          <div className="space-y-1.5">
            {selected.map((id) => {
              const p = roster.find((rp) => rp.id === id);
              if (!p) return null;
              const pos = positions[id] ?? p.primaryPosition;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between"
                >
                  <span className="text-slate-200">
                    {p.name}{" "}
                    <span className="text-slate-500">#{p.number ?? "-"}</span>
                  </span>
                  <span className="flex items-center gap-2 text-slate-400">
                    {POSITION_LABELS[pos]}
                    <PositionBadge position={pos} size="xs" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
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
