"use client";

import { useState } from "react";
import type { Plan } from "@prisma/client";
import { AlertTriangle, ArrowRight, ExternalLink } from "lucide-react";

export function BillingClient({
  plan,
  hasStripeCustomer,
  stripeConfigured,
}: {
  plan: Plan;
  hasStripeCustomer: boolean;
  stripeConfigured: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(target: "COACH_PRO" | "CLUB", interval: "month" | "year") {
    setBusy(target);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target, interval }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not start checkout.");
      }
      const j = (await res.json()) as { url: string };
      window.location.href = j.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function manage() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-portal", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not open portal.");
      }
      const j = (await res.json()) as { url: string };
      window.location.href = j.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  if (!stripeConfigured) {
    return (
      <div className="flex max-w-sm items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          Billing is not configured on this server. Set{" "}
          <code className="font-mono">STRIPE_SECRET_KEY</code> in{" "}
          <code className="font-mono">.env</code> to enable checkout.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <span className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </span>
      )}
      {plan === "FREE" ? (
        <>
          <button
            type="button"
            disabled={busy === "COACH_PRO"}
            onClick={() => checkout("COACH_PRO", "month")}
            className="btn-primary"
          >
            {busy === "COACH_PRO" ? "Opening Stripe…" : "Upgrade to Coach Pro"}
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            disabled={busy === "CLUB"}
            onClick={() => checkout("CLUB", "month")}
            className="btn-secondary"
          >
            {busy === "CLUB" ? "Opening Stripe…" : "Upgrade to Club"}
          </button>
        </>
      ) : (
        hasStripeCustomer && (
          <button
            type="button"
            disabled={busy === "portal"}
            onClick={manage}
            className="btn-navy"
          >
            {busy === "portal" ? "Opening portal…" : "Manage subscription"}
            <ExternalLink size={18} strokeWidth={2} aria-hidden />
          </button>
        )
      )}
    </div>
  );
}
