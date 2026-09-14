"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

// Removes ONE parent's link to one player.
export function RevokeParentButton({
  teamId,
  linkId,
  parentEmail,
  playerName,
}: {
  teamId: string;
  linkId: string;
  parentEmail: string;
  playerName: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function revoke() {
    setBusy(true);
    await fetch(`/api/teams/${teamId}/parent-links/${linkId}`, { method: "DELETE" });
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
          {busy ? "…" : "Remove"}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="btn-ghost shrink-0 px-2 py-1 text-xs"
      title={`Remove ${parentEmail}'s access to ${playerName}`}
    >
      <X size={14} strokeWidth={2} aria-hidden />
      Remove
    </button>
  );
}
