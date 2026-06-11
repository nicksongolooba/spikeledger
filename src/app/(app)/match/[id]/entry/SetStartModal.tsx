"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

// Captures how a set begins so auto-rotation has the right starting point:
// who serves first and which rotation we open in. Rotation only advances on a
// side-out, so the very first point can't be scored correctly until the app
// knows whether we or the opponent are serving.
export function SetStartModal({
  open,
  setNumber,
  initialServing,
  initialRotation,
  onConfirm,
  onClose,
}: {
  open: boolean;
  setNumber: number;
  initialServing: "us" | "them";
  initialRotation: number;
  onConfirm: (serving: "us" | "them", rotation: number) => void;
  onClose: () => void;
}) {
  const [serving, setServing] = useState<"us" | "them">(initialServing);
  const [rotation, setRotation] = useState<number>(initialRotation);

  // Re-seed from the live state each time the modal is opened.
  useEffect(() => {
    if (open) {
      setServing(initialServing);
      setRotation(initialRotation);
    }
  }, [open, initialServing, initialRotation]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Set ${setNumber} - who serves first?`}
      className="max-w-md"
    >
      <p className="mb-4 text-sm text-slate-400">
        Rotation only advances when you win the serve back (a side-out), so set
        this right and the rest tracks itself.
      </p>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Serving first
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["us", "them"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => setServing(side)}
            className={cn(
              "rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
              serving === side
                ? "border-volt-400 bg-volt-400/10 text-volt-200"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700",
            )}
          >
            {side === "us" ? "We serve" : "They serve"}
          </button>
        ))}
      </div>

      <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Starting rotation
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRotation(r)}
            className={cn(
              "stat-number rounded-lg border py-2 text-sm font-bold transition-colors",
              rotation === r
                ? "border-volt-400 bg-volt-400/10 text-volt-200"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700",
            )}
          >
            R{r}
          </button>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(serving, rotation)}
          className="btn-primary"
        >
          Start set
        </button>
      </div>
    </Modal>
  );
}
