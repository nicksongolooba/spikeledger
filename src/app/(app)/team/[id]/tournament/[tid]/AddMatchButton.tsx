"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
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
        <Plus size={18} strokeWidth={2} aria-hidden />
        Add match
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
              Sets and the result get filled in during stat entry.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle
                size={16}
                strokeWidth={2}
                className="mt-0.5 shrink-0"
                aria-hidden
              />
              <span>{error}</span>
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
