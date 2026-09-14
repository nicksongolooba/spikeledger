"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function UnlinkButton({ linkId, playerName }: { linkId: string; playerName: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function unlink() {
    setBusy(true);
    await fetch(`/api/parent/links/${linkId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1">
        <button type="button" onClick={() => setConfirm(false)} className="btn-ghost px-2 py-1 text-xs">
          Keep
        </button>
        <button type="button" onClick={unlink} disabled={busy} className="btn-danger px-2 py-1 text-xs">
          {busy ? "…" : "Remove"}
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="btn-ghost px-2 py-1 text-xs"
      title={`Stop following ${playerName}`}
    >
      <X size={14} strokeWidth={2} aria-hidden />
      Remove
    </button>
  );
}
