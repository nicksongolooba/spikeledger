"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Position } from "@prisma/client";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Heart,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { POSITIONS, POSITION_LABELS } from "@/lib/positions";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatDate } from "@/lib/utils";
import { parentCodeStatus, type ParentCodeStatus } from "@/lib/parent-constants";

export interface RosterParentLink {
  id: string;
  linkedAt: string;
  parentName: string | null;
  parentEmail: string;
}

export interface RosterPlayerRow {
  id: string;
  name: string;
  number: number | null;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  isActive: boolean;
  parentCode: string | null;
  parentCodeRedemptions: number;
  parentCodeExpiresAt: string | null;
  parentLinks: RosterParentLink[];
}

export interface ParentLinkNotice {
  id: string;
  playerName: string;
  parentName: string | null;
  parentEmail: string;
  linkedAt: string;
}

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
  usesPositions,
  initialPlayers,
  notices,
}: {
  teamId: string;
  usesPositions: boolean;
  initialPlayers: RosterPlayerRow[];
  notices: ParentLinkNotice[];
}) {
  const router = useRouter();

  // Remove ONE parent's link (wrong person redeemed the code).
  async function removeLink(linkId: string) {
    const res = await fetch(`/api/teams/${teamId}/parent-links/${linkId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }
  async function dismissNotice(linkId: string) {
    await fetch(`/api/teams/${teamId}/parent-links/${linkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen: true }),
    });
    router.refresh();
  }
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlayerFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [parentFor, setParentFor] = useState<RosterPlayerRow | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(usesPositions ? EMPTY_FORM : { ...EMPTY_FORM, primaryPosition: "UTIL" });
    setError(null);
    setOpen(true);
  }

  function openEdit(p: RosterPlayerRow) {
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
      // No-positions teams store every player as Utility; positions are
      // hidden in the UI but kept so switching modes later loses nothing.
      primaryPosition: usesPositions ? form.primaryPosition : editingId ? form.primaryPosition : "UTIL",
      secondaryPosition:
        usesPositions && form.secondaryPosition !== "" ? form.secondaryPosition : null,
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

  async function toggleActive(p: RosterPlayerRow) {
    const res = await fetch(`/api/teams/${teamId}/players/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (res.ok) router.refresh();
  }

  const activePlayers = initialPlayers.filter((p) => p.isActive);
  const inactivePlayers = initialPlayers.filter((p) => !p.isActive);
  const linkedCount = initialPlayers.reduce((n, p) => n + (p.parentLinks.length > 0 ? 1 : 0), 0);

  return (
    <>
      {notices.length > 0 && (
        <ul className="mb-6 space-y-2" aria-label="New parent links">
          {notices.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-200 bg-navy-50 px-4 py-2.5 text-sm text-navy-900"
            >
              <span className="inline-flex items-center gap-2">
                <Heart size={16} strokeWidth={2} className="shrink-0 text-navy-700" aria-hidden />
                <span>
                  <span className="font-semibold">{n.playerName}&apos;s parent</span>{" "}
                  <span className="text-navy-700">({n.parentEmail})</span> linked{" "}
                  <span className="text-navy-600">· {formatDate(n.linkedAt)}</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => dismissNotice(n.id)}
                className="btn-ghost px-2 py-1 text-xs"
                aria-label={`Dismiss notice about ${n.playerName}'s parent`}
              >
                <X size={14} strokeWidth={2} aria-hidden />
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {initialPlayers.length > 0 && (
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{activePlayers.length}</span> active
            {inactivePlayers.length > 0 && (
              <>
                {" "}·{" "}
                <span className="font-semibold text-slate-900">{inactivePlayers.length}</span> inactive
              </>
            )}
            {" "}·{" "}
            <span className="font-semibold text-slate-900">{linkedCount}</span>{" "}
            with parents linked
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
          <PlayerTable
            players={activePlayers}
            usesPositions={usesPositions}
            onEdit={openEdit}
            onToggle={toggleActive}
            onParent={setParentFor}
            onRemoveLink={removeLink}
          />
          {inactivePlayers.length > 0 && (
            <div className="mt-10">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="eyebrow text-slate-500">Inactive</h3>
                <span className="chip">{inactivePlayers.length}</span>
              </div>
              <PlayerTable
                players={inactivePlayers}
                usesPositions={usesPositions}
                onEdit={openEdit}
                onToggle={toggleActive}
                onParent={setParentFor}
                onRemoveLink={removeLink}
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
            {usesPositions && (
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
            )}
          </div>
          {usesPositions ? (
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
          ) : (
            <p className="text-xs text-slate-500">
              No positions on this team - everyone rotates through every spot.
              Turn positions on in team settings if that changes.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Saving…" : editingId ? "Save changes" : "Add player"}
            </button>
          </div>
        </form>
      </Modal>

      <ParentAccessModal
        teamId={teamId}
        player={parentFor}
        onClose={() => setParentFor(null)}
        onRemoveLink={removeLink}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Parent access: issue / copy / regenerate / revoke a player's parent code.
// ---------------------------------------------------------------------------
function ParentAccessModal({
  teamId,
  player,
  onClose,
  onRemoveLink,
}: {
  teamId: string;
  player: RosterPlayerRow | null;
  onClose: () => void;
  onRemoveLink: (linkId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const [removingLink, setRemovingLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<"issue" | "revoke" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  // The modal is remounted per player via `key` below, so state resets.
  const status: ParentCodeStatus | null = player
    ? issued
      ? { state: "active", code: issued.code, redemptions: 0, max: 3, expiresAt: new Date(issued.expiresAt) }
      : parentCodeStatus(player)
    : null;
  const current = status?.code ?? null;

  async function issue() {
    if (!player) return;
    setBusy("issue");
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/players/${player.id}/parent-code`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as { code?: string; expiresAt?: string; error?: string };
    setBusy(null);
    if (!res.ok || !data.code || !data.expiresAt) {
      setError(data.error || "Could not create a code.");
      return;
    }
    setIssued({ code: data.code, expiresAt: data.expiresAt });
    router.refresh();
  }

  async function revoke() {
    if (!player) return;
    setBusy("revoke");
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/players/${player.id}/parent-code`, {
      method: "DELETE",
    });
    setBusy(null);
    if (!res.ok) {
      setError("Could not revoke access.");
      return;
    }
    setIssued(null);
    setConfirmRevoke(false);
    router.refresh();
    onClose();
  }

  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked - the code is still visible to copy by hand.
    }
  }

  return (
    <Modal
      key={player?.id ?? "none"}
      open={!!player}
      onClose={onClose}
      title={player ? `Parent access - ${player.name}` : "Parent access"}
    >
      {player && (
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Give this code to {player.name}&apos;s parent. They enter it when
            they create a SpikeLedger account (choosing &ldquo;I&apos;m a
            parent&rdquo;) or later in their settings. They will see only{" "}
            {player.name}&apos;s stats, compared to team averages - never
            another player&apos;s numbers. A code works 3 times (parents,
            aunts, uncles) for 30 days.
          </p>

          {current && status ? (
            <div
              className={cn(
                "rounded-lg border p-4",
                status.state === "active" ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="eyebrow text-slate-500">Parent code</div>
                <CodeUsageChip status={status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="stat-number text-4xl font-bold tracking-wide text-navy-900">
                  {current}
                </span>
                <button type="button" onClick={copy} className="btn-secondary">
                  {copied ? (
                    <Check size={16} strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Copy size={16} strokeWidth={2} aria-hidden />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={issue}
                  disabled={busy !== null}
                  className="btn-ghost"
                  title="Make a new code - parents already linked stay linked"
                >
                  <RefreshCw size={16} strokeWidth={2} aria-hidden />
                  New code
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {status.state === "expired"
                  ? "This code has expired. Create a new one to let more family members link."
                  : status.state === "exhausted"
                    ? "This code has been used 3 times. Create a new one to let more family members link."
                    : `Valid until ${status.expiresAt ? formatDate(status.expiresAt) : "-"}. Text it, WhatsApp it, or read it out at pickup.`}{" "}
                A new code replaces this one for future parents; anyone
                already linked keeps access.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center">
              <p className="text-sm text-slate-600">No parent code yet.</p>
              <button
                type="button"
                onClick={issue}
                disabled={busy !== null}
                className="btn-primary mt-3"
              >
                {busy === "issue" ? "Creating…" : "Create parent code"}
              </button>
            </div>
          )}

          <div>
            <div className="eyebrow text-slate-500">Linked parents</div>
            {player.parentLinks.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nobody has linked yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {player.parentLinks.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">
                        {l.parentName ?? "Parent"}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {l.parentEmail} · since {formatDate(l.linkedAt)}
                      </div>
                    </div>
                    {removingLink === l.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => setRemovingLink(null)} className="btn-ghost px-2 py-1 text-xs">
                          Keep
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await onRemoveLink(l.id);
                            setRemovingLink(null);
                          }}
                          className="btn-danger px-2 py-1 text-xs"
                        >
                          Remove
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRemovingLink(l.id)}
                        className="btn-ghost shrink-0 px-2 py-1 text-xs"
                        aria-label={`Remove ${l.parentEmail}`}
                      >
                        <X size={14} strokeWidth={2} aria-hidden />
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {(current || player.parentLinks.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              {confirmRevoke ? (
                <>
                  <span className="text-sm text-slate-700">
                    Unlink every parent and cancel the code?
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmRevoke(false)} className="btn-secondary">
                      Keep
                    </button>
                    <button type="button" onClick={revoke} disabled={busy !== null} className="btn-danger">
                      {busy === "revoke" ? "Revoking…" : "Revoke access"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-xs text-slate-500">
                    Revoking removes every linked parent and cancels the code.
                  </span>
                  <button type="button" onClick={() => setConfirmRevoke(true)} className="btn-danger">
                    <Trash2 size={16} strokeWidth={2} aria-hidden />
                    Revoke access
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("eyebrow px-4 py-2.5 text-left text-slate-500", className)}>
      {children}
    </th>
  );
}

// "1/3" code usage chip. Colors: none (grey), active (navy), expired
// (amber), used up (red).
function CodeUsageChip({ status }: { status: ParentCodeStatus }) {
  const tone =
    status.state === "none"
      ? "bg-slate-100 text-slate-500"
      : status.state === "active"
        ? "bg-navy-50 text-navy-800"
        : status.state === "expired"
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-700";
  const label =
    status.state === "none"
      ? "No code"
      : `${status.redemptions}/${status.max}${status.state === "expired" ? " · expired" : status.state === "exhausted" ? " · used up" : ""}`;
  const title =
    status.state === "none"
      ? "No parent code issued yet"
      : `Code used ${status.redemptions} of ${status.max} times${status.expiresAt ? ` · valid until ${formatDate(status.expiresAt)}` : ""}`;
  return (
    <span className={cn("stat-number inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold", tone)} title={title}>
      {label}
    </span>
  );
}

// Linked parent emails under a player, each removable on its own.
function ParentLinksList({
  links,
  onRemoveLink,
}: {
  links: RosterParentLink[];
  onRemoveLink: (linkId: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (links.length === 0) return <span className="text-xs text-slate-400">No parents linked</span>;
  return (
    <ul className="space-y-0.5">
      {links.map((l) => (
        <li key={l.id} className="flex items-center gap-1.5 text-xs text-slate-700">
          <Heart size={11} strokeWidth={2.5} className="shrink-0 text-navy-700" aria-hidden />
          <span className="truncate" title={l.parentName ?? undefined}>{l.parentEmail}</span>
          {confirming === l.id ? (
            <span className="ml-1 inline-flex items-center gap-1">
              <button type="button" onClick={() => setConfirming(null)} className="rounded px-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900">
                Keep
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onRemoveLink(l.id);
                  setConfirming(null);
                }}
                className="rounded bg-red-50 px-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
              >
                Remove
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(l.id)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-700"
              aria-label={`Remove ${l.parentEmail}`}
              title="Remove this parent"
            >
              <X size={12} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function PlayerTable({
  players,
  usesPositions,
  onEdit,
  onToggle,
  onParent,
  onRemoveLink,
  dim,
}: {
  players: RosterPlayerRow[];
  usesPositions: boolean;
  onEdit: (p: RosterPlayerRow) => void;
  onToggle: (p: RosterPlayerRow) => void;
  onParent: (p: RosterPlayerRow) => void;
  onRemoveLink: (linkId: string) => Promise<void>;
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
            {usesPositions ? (
              <>
                <Th>Primary</Th>
                <Th>Secondary</Th>
              </>
            ) : (
              <Th>Role</Th>
            )}
            <Th>Parents</Th>
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
              {usesPositions ? (
                <>
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
                </>
              ) : (
                <td className="px-4 py-3">
                  <PositionBadge position={p.primaryPosition} neutral />
                </td>
              )}
              <td className="px-4 py-3 align-top">
                <div className="flex items-center gap-2">
                  <CodeUsageChip status={parentCodeStatus(p)} />
                  <button
                    onClick={() => onParent(p)}
                    className="btn-ghost px-2 py-1 text-xs"
                  >
                    <Heart size={14} strokeWidth={2} aria-hidden />
                    Parent access
                  </button>
                </div>
                <div className="mt-1.5">
                  <ParentLinksList links={p.parentLinks} onRemoveLink={onRemoveLink} />
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex gap-1">
                  <button onClick={() => onEdit(p)} className="btn-ghost px-2.5 py-1 text-xs">
                    <Pencil size={14} strokeWidth={2} aria-hidden />
                    Edit
                  </button>
                  <button onClick={() => onToggle(p)} className="btn-ghost px-2.5 py-1 text-xs">
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
          <li key={p.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="stat-number flex h-10 w-10 shrink-0 items-center justify-center rounded bg-navy-900 text-base font-bold text-white">
                {p.number ?? "-"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-slate-900">{p.name}</span>
                  <CodeUsageChip status={parentCodeStatus(p)} />
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <PositionBadge position={p.primaryPosition} size="xs" neutral={!usesPositions} />
                  {usesPositions && p.secondaryPosition && (
                    <PositionBadge position={p.secondaryPosition} size="xs" />
                  )}
                </div>
              </div>
            </div>
            {p.parentLinks.length > 0 && (
              <div className="mt-2 pl-[52px]">
                <ParentLinksList links={p.parentLinks} onRemoveLink={onRemoveLink} />
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              <button onClick={() => onParent(p)} className="btn-ghost px-2 py-1 text-xs">
                <Heart size={14} strokeWidth={2} aria-hidden />
                Parent access
              </button>
              <button onClick={() => onEdit(p)} className="btn-ghost px-2 py-1 text-xs">
                <Pencil size={14} strokeWidth={2} aria-hidden />
                Edit
              </button>
              <button onClick={() => onToggle(p)} className="btn-ghost px-2 py-1 text-xs">
                {p.isActive ? (
                  <Archive size={14} strokeWidth={2} aria-hidden />
                ) : (
                  <ArchiveRestore size={14} strokeWidth={2} aria-hidden />
                )}
                {p.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
