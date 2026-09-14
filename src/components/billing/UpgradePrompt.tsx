"use client";

import { useState } from "react";
import type { Plan } from "@prisma/client";
import { ArrowRight, Lock } from "lucide-react";
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
        "flex flex-wrap items-center gap-3 rounded-lg border border-navy-200 bg-navy-50 p-4 " +
        (className ?? "")
      }
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy-900 text-white"
        aria-hidden
      >
        <Lock size={16} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-navy-900">
          {reason.feature} · {PLAN_LABEL[reason.recommendedPlan]}
        </div>
        <div className="text-xs text-navy-800">{reason.reason}</div>
      </div>
      <button
        type="button"
        onClick={onUpgrade ?? (() => (window.location.href = "/settings/billing"))}
        className="btn-primary px-3 py-1.5 text-xs"
      >
        Upgrade
        <ArrowRight size={14} strokeWidth={2} aria-hidden />
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
  const perLabel = interval === "month" ? "/ month" : "/ year";

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
        <div className="inline-flex items-center gap-1.5 rounded border border-navy-200 bg-navy-50 px-2 py-1 text-xs font-semibold text-navy-800">
          <Lock size={12} strokeWidth={2.5} aria-hidden />
          {reason.feature}
        </div>
        <p className="mt-3 text-sm text-slate-700">{reason.reason}</p>

        <div className="mt-5 inline-flex rounded-md border border-slate-200 bg-slate-50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={
              "rounded px-3 py-1.5 font-semibold transition-colors " +
              (interval === "month"
                ? "bg-navy-900 text-white"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={
              "rounded px-3 py-1.5 font-semibold transition-colors " +
              (interval === "year"
                ? "bg-navy-900 text-white"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            Yearly · save 17%
          </button>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="stat-number text-4xl font-bold leading-none text-slate-900">
            {fmtCAD(price)}
          </span>
          <span className="text-sm text-slate-500">{perLabel}</span>
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
            className="btn-primary"
          >
            {busy ? "Opening Stripe…" : "Continue to checkout"}
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-500">
          Cancel any time. Your data stays if you downgrade.
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
        "inline-flex items-center gap-1 rounded border border-navy-200 bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy-800 " +
        (className ?? "")
      }
    >
      <Lock size={10} strokeWidth={2.5} aria-hidden />
      Pro
    </span>
  );
}
