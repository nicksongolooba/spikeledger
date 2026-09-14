"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

// Revokes parent access for one player (all of that player's parents).
export function RevokeParentButton({
  teamId,
  playerId,
  playerName,
}: {
  teamId: string;
  playerId: string;
  playerName: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function revoke() {
    setBusy(true);
    await fetch(`/api/teams/${teamId}/players/${playerId}/parent-code`, { method: "DELETE" });
    setBusy(false);
    setConfirm(false);
    router.refresh();
  }

  if (confirm) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => setConfirm(false)} className="btn-ghost px-2 py-1 text-xs">
          Keep
        </button>
        <button type="button" onClick={revoke} disabled={busy} className="btn-danger px-2 py-1 text-xs">
          {busy ? "…" : "Revoke"}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="btn-ghost shrink-0 px-2 py-1 text-xs"
      title={`Revoke every parent's access to ${playerName}`}
    >
      <Trash2 size={14} strokeWidth={2} aria-hidden />
      Revoke
    </button>
  );
}
