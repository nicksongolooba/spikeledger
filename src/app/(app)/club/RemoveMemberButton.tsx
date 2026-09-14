"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";

export function RemoveMemberButton({
  memberId,
  name,
}: {
  memberId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/club/members/${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not remove this coach.");
      setBusy(false);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-danger px-2.5 py-1 text-xs"
      >
        Remove
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Remove coach">
        <p className="text-sm text-slate-700">
          Remove <span className="font-semibold text-slate-900">{name}</span>{" "}
          from the club? They keep their own teams, but those teams stop being
          shared with the club and they lose access to club teams.
        </p>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={remove} disabled={busy} className="btn-danger">
            {busy ? "Removing…" : "Remove coach"}
          </button>
        </div>
      </Modal>
    </>
  );
}
