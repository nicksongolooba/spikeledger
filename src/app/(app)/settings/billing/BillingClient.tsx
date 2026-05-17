"use client";

import { useState } from "react";
import type { Plan } from "@prisma/client";

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
      <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">
        Billing is not configured on this server. Set <code className="font-mono">STRIPE_SECRET_KEY</code> in <code className="font-mono">.env</code> to enable checkout.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      {error && (
        <span className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs text-red-300">
          {error}
        </span>
      )}
      {plan === "FREE" ? (
        <>
          <button
            type="button"
            disabled={busy === "COACH_PRO"}
            onClick={() => checkout("COACH_PRO", "month")}
            className="bg-violet-400 hover:bg-violet-300 text-violet-950 btn"
          >
            {busy === "COACH_PRO" ? "Opening Stripe…" : "Upgrade to Coach Pro"}
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
            className="btn-primary"
          >
            {busy === "portal" ? "Opening portal…" : "Manage subscription"}
          </button>
        )
      )}
    </div>
  );
}
