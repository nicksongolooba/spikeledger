"use client";

import { useState } from "react";
import type { Plan } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import {
  PLAN_LABEL,
  PLAN_PRICING,
  fmtCAD,
  type UpgradeReason,
} from "@/lib/plan-limits";

// Inline upgrade banner - used when the gate is just a card or button.
export function UpgradeBanner({
  reason,
  onUpgrade,
  className,
}: {
  reason: UpgradeReason;
  onUpgrade?: () => void;
  className?: string;
}) {
  return (
    <div
      className={
        "flex flex-wrap items-center gap-3 rounded-xl border border-violet-400/30 bg-violet-400/5 p-4 " +
        (className ?? "")
      }
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/15 text-violet-200">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-violet-100">
          {reason.feature} · {PLAN_LABEL[reason.recommendedPlan]}
        </div>
        <div className="text-xs text-violet-100/70">{reason.reason}</div>
      </div>
      <button
        type="button"
        onClick={onUpgrade ?? (() => (window.location.href = "/settings/billing"))}
        className="rounded-lg bg-violet-400 px-3 py-1.5 text-xs font-semibold text-violet-950 transition-colors hover:bg-violet-300"
      >
        Upgrade
      </button>
    </div>
  );
}

// Modal variant - used when the user explicitly tries to take the gated action
// (e.g. clicks the "Add Tournament" button when they're at the limit).
export function UpgradePromptModal({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason: UpgradeReason;
}) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = PLAN_PRICING[reason.recommendedPlan];
  const price = interval === "month" ? pricing.monthlyCents : pricing.yearlyCents;
  const perLabel = interval === "month" ? "/month" : "/year";

  async function checkout() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: reason.recommendedPlan, interval }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not start checkout.");
      }
      const j = (await res.json()) as { url: string };
      window.location.href = j.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Upgrade to ${PLAN_LABEL[reason.recommendedPlan]}`}
      className="max-w-md"
    >
      <div>
        <p className="text-sm text-slate-300">{reason.reason}</p>

        <div className="mt-5 inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={
              "rounded-md px-3 py-1.5 font-semibold transition-colors " +
              (interval === "month"
                ? "bg-volt-400 text-volt-950"
                : "text-slate-400")
            }
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={
              "rounded-md px-3 py-1.5 font-semibold transition-colors " +
              (interval === "year"
                ? "bg-volt-400 text-volt-950"
                : "text-slate-400")
            }
          >
            Yearly · save 17%
          </button>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="stat-number text-3xl font-bold text-slate-100">
            {fmtCAD(price)}
          </span>
          <span className="text-sm text-slate-500">{perLabel}</span>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Not now
          </button>
          <button
            type="button"
            onClick={checkout}
            disabled={busy}
            className="bg-violet-400 hover:bg-violet-300 text-violet-950 btn"
          >
            {busy ? "Opening Stripe…" : "Continue to checkout"}
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-500">
          Cancel anytime · Your data is preserved if you downgrade
        </p>
      </div>
    </Modal>
  );
}

// Convenience hook-shaped state + bound trigger. Pages call openUpgrade(reason)
// from any handler and the modal handles the rest.
export function useUpgradePrompt(): {
  prompt: UpgradeReason | null;
  open: (reason: UpgradeReason) => void;
  close: () => void;
  modal: React.ReactNode;
} {
  // Stateful via React - kept inline so consumers can drop it into one place.
  // The hook returns a JSX `modal` node consumers render somewhere stable.
  // (Defined as a function-call-using-hooks helper so callers stay terse.)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [prompt, setPrompt] = useState<UpgradeReason | null>(null);
  return {
    prompt,
    open: setPrompt,
    close: () => setPrompt(null),
    modal: prompt ? (
      <UpgradePromptModal
        open={true}
        onClose={() => setPrompt(null)}
        reason={prompt}
      />
    ) : null,
  };
}

// Tiny "PRO" pill used inline next to gated UI elements (e.g. the AI checkbox).
export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200 " +
        (className ?? "")
      }
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5">
        <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
      </svg>
      Pro
    </span>
  );
}
