"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Player, Position } from "@prisma/client";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { POSITIONS, POSITION_LABELS } from "@/lib/positions";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {initialPlayers.length > 0 && (
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">
              {activePlayers.length}
            </span>{" "}
            active
            {inactivePlayers.length > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="font-semibold text-slate-900">
                  {inactivePlayers.length}
                </span>{" "}
                inactive
              </>
            )}
          </p>
        )}
        <button onClick={openAdd} className="btn-primary ml-auto">
          <Plus size={18} strokeWidth={2} aria-hidden />
          Add player
        </button>
      </div>

      {initialPlayers.length === 0 ? (
        <EmptyState
          title="No players yet"
          description="Add your first player to start building the roster."
          action={
            <button onClick={openAdd} className="btn-primary">
              <Plus size={18} strokeWidth={2} aria-hidden />
              Add player
            </button>
          }
        />
      ) : (
        <>
          <PlayerTable players={activePlayers} onEdit={openEdit} onToggle={toggleActive} />
          {inactivePlayers.length > 0 && (
            <div className="mt-10">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="eyebrow text-slate-500">Inactive</h3>
                <span className="chip">{inactivePlayers.length}</span>
              </div>
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
                    {p} - {POSITION_LABELS[p]}
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
              <option value="">- None -</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p} - {POSITION_LABELS[p]}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              For dual-role players who play one position some matches and another in others.
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
              {busy ? "Saving…" : editingId ? "Save changes" : "Add player"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("eyebrow px-4 py-2.5 text-left text-slate-500", className)}>
      {children}
    </th>
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
    <div className={cn("card overflow-hidden", dim && "opacity-60")}>
      {/* Desktop table */}
      <table className="hidden w-full text-sm sm:table">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <Th className="w-16">#</Th>
            <Th>Name</Th>
            <Th>Primary</Th>
            <Th>Secondary</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {players.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-slate-50">
              <td className="stat-number px-4 py-3 text-lg font-bold text-slate-900">
                {p.number ?? "-"}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
              <td className="px-4 py-3">
                <PositionBadge position={p.primaryPosition} />
              </td>
              <td className="px-4 py-3">
                {p.secondaryPosition ? (
                  <PositionBadge position={p.secondaryPosition} />
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex gap-1">
                  <button
                    onClick={() => onEdit(p)}
                    className="btn-ghost px-2.5 py-1 text-xs"
                  >
                    <Pencil size={14} strokeWidth={2} aria-hidden />
                    Edit
                  </button>
                  <button
                    onClick={() => onToggle(p)}
                    className="btn-ghost px-2.5 py-1 text-xs"
                  >
                    {p.isActive ? (
                      <Archive size={14} strokeWidth={2} aria-hidden />
                    ) : (
                      <ArchiveRestore size={14} strokeWidth={2} aria-hidden />
                    )}
                    {p.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-slate-100 sm:hidden">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="stat-number flex h-10 w-10 shrink-0 items-center justify-center rounded bg-navy-900 text-base font-bold text-white">
              {p.number ?? "-"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-slate-900">{p.name}</div>
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
                <Pencil size={14} strokeWidth={2} aria-hidden />
                Edit
              </button>
              <button
                onClick={() => onToggle(p)}
                className="btn-ghost px-2 py-1 text-xs"
              >
                {p.isActive ? (
                  <Archive size={14} strokeWidth={2} aria-hidden />
                ) : (
                  <ArchiveRestore size={14} strokeWidth={2} aria-hidden />
                )}
                {p.isActive ? "Off" : "On"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
