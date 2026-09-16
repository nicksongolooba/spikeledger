"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@prisma/client";
import { AlertTriangle, ArrowRight, Check, ExternalLink, RefreshCw } from "lucide-react";

// How long to keep checking after a payment before admitting defeat.
const ACTIVATION_TIMEOUT_MS = 30_000;
const POLL_EVERY_MS = 2_500;

const ACTIVATING_MESSAGE = "Payment received. Activating your plan.";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The billing controls, and the part that makes sure somebody who has just
// paid never sees an Upgrade button.
//
// Coming back from Stripe Checkout, the session id is in the URL. That is
// confirmed against Stripe directly, and if the plan still has not moved, this
// keeps checking for half a minute before it gives up and points at the
// refresh button. At no point during that does the page offer to sell them
// the thing they have already bought.
export function BillingClient({
  plan,
  hasStripeCustomer,
  stripeConfigured,
}: {
  plan: Plan;
  hasStripeCustomer: boolean;
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activatedPlan, setActivatedPlan] = useState<Plan | null>(null);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const startedRef = useRef(false);

  const finish = useCallback(
    (activated: Plan) => {
      setActivatedPlan(activated);
      setActivating(false);
      setError(null);
      router.refresh();
    },
    [router],
  );

  // Path one: confirm the checkout session, then poll until the plan moves.
  const activate = useCallback(
    async (sessionId: string) => {
      setActivating(true);
      setError(null);
      try {
        const res = await fetch("/api/stripe/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const j = (await res.json().catch(() => ({}))) as { activated?: boolean; plan?: Plan };
        if (res.ok && j.activated && j.plan && j.plan !== "FREE") {
          finish(j.plan);
          return;
        }
      } catch {
        // Fall through to polling; the webhook may still land.
      }

      const deadline = Date.now() + ACTIVATION_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await wait(POLL_EVERY_MS);
        try {
          const res = await fetch("/api/stripe/reconcile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ force: true }),
          });
          const j = (await res.json().catch(() => ({}))) as { plan?: Plan };
          if (j.plan && j.plan !== "FREE") {
            finish(j.plan);
            return;
          }
        } catch {
          // Keep trying until the deadline.
        }
      }
      setActivating(false);
      setError(
        "Your payment went through, but the plan has not switched over yet. Use Refresh my plan below in a moment. If it is still not right, reply to your receipt and we will sort it out.",
      );
    },
    [finish],
  );

  useEffect(() => {
    if (startedRef.current) return;
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) return;
    startedRef.current = true;
    // Taken out of the address bar so a reload does not run it again.
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.toString());
    void activate(sessionId);
  }, [activate]);

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

  // Path three: the escape hatch. Forces a fresh Stripe lookup and says what
  // it found, so a coach who has paid is never stuck with nothing to try.
  async function refreshPlan() {
    setBusy("refresh");
    setError(null);
    setRefreshResult(null);
    try {
      const res = await fetch("/api/stripe/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string; plan?: Plan };
      setRefreshResult(j.message ?? "Checked with Stripe.");
      if (j.plan && j.plan !== plan) router.refresh();
    } catch {
      setRefreshResult("Could not reach Stripe just now. Nothing about your plan has changed.");
    } finally {
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

  const paidPlan = activatedPlan ?? (plan !== "FREE" ? plan : null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {error && (
          <span className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {error}
          </span>
        )}

        {activating ? (
          <span className="inline-flex items-center gap-2 rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-navy-900">
            <RefreshCw size={16} strokeWidth={2} className="animate-spin" aria-hidden />
            {ACTIVATING_MESSAGE}
          </span>
        ) : activatedPlan ? (
          <span className="inline-flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
            <Check size={16} strokeWidth={2.5} aria-hidden />
            You are on {activatedPlan === "CLUB" ? "Club" : "Coach Pro"}. Thanks for subscribing.
          </span>
        ) : paidPlan === null ? (
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
            <button type="button" disabled={busy === "portal"} onClick={manage} className="btn-navy">
              {busy === "portal" ? "Opening portal…" : "Manage subscription"}
              <ExternalLink size={18} strokeWidth={2} aria-hidden />
            </button>
          )
        )}

        {!activating && (
          <button
            type="button"
            disabled={busy === "refresh"}
            onClick={refreshPlan}
            className="btn-ghost px-3 py-2 text-xs"
            title="Checks your subscription with Stripe and corrects your plan if they disagree"
          >
            <RefreshCw size={14} strokeWidth={2} aria-hidden />
            {busy === "refresh" ? "Checking Stripe…" : "Refresh my plan"}
          </button>
        )}
      </div>

      {refreshResult && <p className="text-xs text-slate-600">{refreshResult}</p>}
    </div>
  );
}
