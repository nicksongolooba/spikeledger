"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

export function AddMatchButton({
  teamId: _teamId,
  tournamentId,
  nextMatchNumber,
  variant = "default",
}: {
  teamId: string;
  tournamentId: string;
  nextMatchNumber: number;
  variant?: "default" | "prominent";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [number, setNumber] = useState(nextMatchNumber.toString());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/tournaments/${tournamentId}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opponent,
        matchNumber: Number(number),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create match.");
      return;
    }
    setOpen(false);
    setOpponent("");
    setNumber((Number(number) + 1).toString());
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={variant === "prominent" ? "btn-primary px-5 py-2.5" : "btn-primary"}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
        Add Match
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add match">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="m-opp" className="label">Opponent</label>
            <input
              id="m-opp"
              required
              autoFocus
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              className="input"
              placeholder="Durham Attack"
            />
          </div>
          <div>
            <label htmlFor="m-num" className="label">Match number</label>
            <input
              id="m-num"
              required
              type="number"
              min={1}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="input stat-number"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Sets and result can be entered after the match in Phase 2 stat entry.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Adding…" : "Add match"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
