"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Player, Position } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { POSITIONS, POSITION_LABELS } from "@/lib/positions";
import { EmptyState } from "@/components/ui/EmptyState";

type EditingPlayer = Pick<
  Player,
  "id" | "name" | "number" | "primaryPosition" | "secondaryPosition" | "isActive"
>;

interface PlayerFormState {
  name: string;
  number: string;
  primaryPosition: Position;
  secondaryPosition: Position | "";
}

const EMPTY_FORM: PlayerFormState = {
  name: "",
  number: "",
  primaryPosition: "OH",
  secondaryPosition: "",
};

export function RosterClient({
  teamId,
  initialPlayers,
}: {
  teamId: string;
  initialPlayers: EditingPlayer[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlayerFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEdit(p: EditingPlayer) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      number: p.number?.toString() ?? "",
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const body = {
      name: form.name.trim(),
      number: form.number ? Number(form.number) : null,
      primaryPosition: form.primaryPosition,
      secondaryPosition: form.secondaryPosition === "" ? null : form.secondaryPosition,
    };

    const res = await fetch(
      editingId
        ? `/api/teams/${teamId}/players/${editingId}`
        : `/api/teams/${teamId}/players`,
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save player.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function toggleActive(p: EditingPlayer) {
    const res = await fetch(`/api/teams/${teamId}/players/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (res.ok) router.refresh();
  }

  const activePlayers = initialPlayers.filter((p) => p.isActive);
  const inactivePlayers = initialPlayers.filter((p) => !p.isActive);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button onClick={openAdd} className="btn-primary">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          Add Player
        </button>
      </div>

      {initialPlayers.length === 0 ? (
        <EmptyState
          title="No players yet"
          description="Add your first player to start building the roster."
          action={
            <button onClick={openAdd} className="btn-primary">
              Add Player
            </button>
          }
        />
      ) : (
        <>
          <PlayerTable players={activePlayers} onEdit={openEdit} onToggle={toggleActive} />
          {inactivePlayers.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Inactive
              </h3>
              <PlayerTable
                players={inactivePlayers}
                onEdit={openEdit}
                onToggle={toggleActive}
                dim
              />
            </div>
          )}
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit player" : "Add player"}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="p-name" className="label">Name</label>
            <input
              id="p-name"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Maya"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="p-number" className="label">Jersey number</label>
              <input
                id="p-number"
                type="number"
                required
                min={0}
                max={99}
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                className="input stat-number"
                placeholder="7"
              />
            </div>
            <div>
              <label htmlFor="p-pos" className="label">Primary position</label>
              <select
                id="p-pos"
                required
                value={form.primaryPosition}
                onChange={(e) =>
                  setForm({ ...form, primaryPosition: e.target.value as Position })
                }
                className="input"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p} — {POSITION_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="p-pos2" className="label">
              Secondary position{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <select
              id="p-pos2"
              value={form.secondaryPosition}
              onChange={(e) =>
                setForm({
                  ...form,
                  secondaryPosition: e.target.value as Position | "",
                })
              }
              className="input"
            >
              <option value="">— None —</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p} — {POSITION_LABELS[p]}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              For dual-role players who play one position some matches and another in others.
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
              {busy ? "Saving…" : editingId ? "Save changes" : "Add player"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function PlayerTable({
  players,
  onEdit,
  onToggle,
  dim,
}: {
  players: EditingPlayer[];
  onEdit: (p: EditingPlayer) => void;
  onToggle: (p: EditingPlayer) => void;
  dim?: boolean;
}) {
  return (
    <div className={`card overflow-hidden ${dim ? "opacity-60" : ""}`}>
      {/* Desktop table */}
      <table className="hidden w-full text-sm sm:table">
        <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5 text-left">#</th>
            <th className="px-4 py-2.5 text-left">Name</th>
            <th className="px-4 py-2.5 text-left">Primary</th>
            <th className="px-4 py-2.5 text-left">Secondary</th>
            <th className="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {players.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-slate-800/40">
              <td className="px-4 py-2.5 stat-number font-bold text-slate-300">
                {p.number ?? "—"}
              </td>
              <td className="px-4 py-2.5 font-medium text-slate-100">{p.name}</td>
              <td className="px-4 py-2.5">
                <PositionBadge position={p.primaryPosition} />
              </td>
              <td className="px-4 py-2.5">
                {p.secondaryPosition ? (
                  <PositionBadge position={p.secondaryPosition} />
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => onEdit(p)}
                  className="btn-ghost px-2.5 py-1 text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => onToggle(p)}
                  className="btn-ghost px-2.5 py-1 text-xs"
                >
                  {p.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-slate-800 sm:hidden">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 stat-number text-sm font-bold">
              {p.number ?? "—"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-100">{p.name}</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                <PositionBadge position={p.primaryPosition} size="xs" />
                {p.secondaryPosition && (
                  <PositionBadge position={p.secondaryPosition} size="xs" />
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => onEdit(p)}
                className="btn-ghost px-2 py-1 text-xs"
              >
                Edit
              </button>
              <button
                onClick={() => onToggle(p)}
                className="btn-ghost px-2 py-1 text-xs"
              >
                {p.isActive ? "Off" : "On"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
