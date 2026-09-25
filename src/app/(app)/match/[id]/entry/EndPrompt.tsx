"use client";

import { Flag } from "lucide-react";

// A question under the scoreboard: "Set 1: 25-22. End set?" or "Match won
// 2-1. End match?". It only ever asks. Nothing ends until the coach taps the
// main button, so passing through a winning score while fixing the score with
// minus ends nothing. It sits in the page rather than over it, so it never
// gets in the way of the next tap on the score.
export function EndPrompt({
  kind,
  message,
  confirmLabel,
  onConfirm,
  cancelLabel,
  onCancel,
}: {
  kind: "set" | "match";
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel: string;
  onCancel: () => void;
}) {
  return (
    <div
      role="status"
      data-end-prompt={kind}
      className="rounded-lg border-2 border-cyan-500 bg-cyan-50 px-4 py-3"
    >
      {/* The question gets its own line; on a phone the buttons sit under it. */}
      <div className="flex items-center gap-2">
        <Flag size={18} strokeWidth={2.25} className="shrink-0 text-cyan-700" aria-hidden />
        <span className="font-display text-lg font-bold leading-snug text-navy-950">{message}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary min-h-[44px]">
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} className="btn-primary min-h-[44px]">
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
