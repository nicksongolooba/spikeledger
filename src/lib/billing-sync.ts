// Keeping the app's idea of a plan the same as Stripe's.
//
// The webhook is not allowed to be the only path. It times out, it hits a cold
// start, it gets retried, and none of that is the coach's fault. Someone who
// has just been charged must never be looking at an Upgrade button. So the
// plan can be set from three independent directions and they cannot conflict:
//
//   1. the checkout redirect, which retrieves the session straight from Stripe
//   2. this reconcile, which runs when the billing page loads and behind the
//      "Refresh my plan" button
//   3. the webhook, which is now idempotent on the Stripe event id
//
// All three funnel into applyPlan() below, which is a plain write of what
// Stripe says. Running it twice changes nothing the second time.
//
// The status rules matter as much as the plumbing:
//   active, trialing, past_due   keep the plan in full
//   canceled, unpaid, incomplete_expired   drop to FREE
//
// past_due is Stripe retrying a card, which can take a week or more. Treating
// it as cancelled is what turns an expired card into eight coaches losing
// access on a tournament morning.

import type Stripe from "stripe";
import { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

// Stripe still considers the subscription live, so we do too.
export const LIVE_STATUSES = ["active", "trialing", "past_due"] as const;
// Stripe has given up, or it never started.
export const DEAD_STATUSES = ["canceled", "unpaid", "incomplete_expired"] as const;

export function statusKeepsAccess(status: string | null | undefined): boolean {
  return LIVE_STATUSES.includes((status ?? "") as (typeof LIVE_STATUSES)[number]);
}

export function planFromMetadata(meta: Stripe.Metadata | null | undefined): Plan {
  const v = meta?.plan;
  if (v === "COACH_PRO" || v === "CLUB") return v;
  return "COACH_PRO";
}

// The plan a subscription grants right now, and the status behind it.
export function planFromSubscription(sub: Stripe.Subscription): {
  plan: Plan;
  status: string;
  cancelAt: Date | null;
} {
  const status = sub.status;
  const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000) : null;
  if (!statusKeepsAccess(status)) return { plan: "FREE", status, cancelAt: null };
  return { plan: planFromMetadata(sub.metadata), status, cancelAt };
}

// ---------------------------------------------------------------------------
// Never downgrade mid-match
// ---------------------------------------------------------------------------

const MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

// Any match this user could be scoring right now: on a team they coach, or on
// any team in a club they own. A downgrade waits for it to finish.
export async function userHasMatchInProgress(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - MATCH_WINDOW_MS);
  const match = await prisma.match.findFirst({
    where: {
      result: null,
      startedAt: { gte: since },
      tournament: {
        team: {
          OR: [
            { coachId: userId },
            { club: { is: { members: { some: { userId, role: "OWNER" } } } } },
          ],
        },
      },
    },
    select: { id: true },
  });
  return Boolean(match);
}

export interface PlanWrite {
  plan: Plan;
  status: string | null;
  subscriptionId: string | null;
  cancelAt: Date | null;
}

export type ApplyResult =
  | { applied: true; plan: Plan; changed: boolean }
  | { applied: false; reason: "deferred-live-match"; plan: Plan };

// The single write. Idempotent: the same input twice leaves the same row.
//
// A downgrade is held back while a match is being scored. Nothing else is: an
// upgrade during a match is a gift, not an interruption.
export async function applyPlan(userId: string, next: PlanWrite): Promise<ApplyResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, subscriptionStatus: true, stripeSubscriptionId: true, planExpiresAt: true },
  });
  if (!user) return { applied: true, plan: next.plan, changed: false };

  const isDowngrade = user.plan !== "FREE" && next.plan === "FREE";
  if (isDowngrade && (await userHasMatchInProgress(userId))) {
    // Recorded, not applied. flushPendingDowngrade() picks it up when the
    // match ends, and the next reconcile would catch it anyway.
    await prisma.user.update({
      where: { id: userId },
      data: { pendingDowngradeAt: new Date(), subscriptionStatus: next.status },
    });
    console.info(
      `[billing] downgrade deferred for ${userId}: a match is in progress (status ${next.status})`,
    );
    return { applied: false, reason: "deferred-live-match", plan: user.plan };
  }

  const changed =
    user.plan !== next.plan ||
    user.subscriptionStatus !== next.status ||
    user.stripeSubscriptionId !== next.subscriptionId;

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: next.plan,
      subscriptionStatus: next.status,
      stripeSubscriptionId: next.subscriptionId,
      planExpiresAt: next.cancelAt,
      pendingDowngradeAt: null,
      // A successful paid state clears the dunning state entirely.
      ...(next.plan !== "FREE" && next.status !== "past_due"
        ? { paymentFailedAt: null, dunningEmailsSent: 0, lastDunningEmailAt: null }
        : {}),
    },
  });

  if (next.plan === "CLUB") {
    const { ensureClubForOwner } = await import("@/lib/club");
    await ensureClubForOwner(userId).catch((err) =>
      console.error("[billing] ensureClubForOwner failed:", err),
    );
  }
  return { applied: true, plan: next.plan, changed };
}

// Applies a downgrade that was waiting for a match to end. Safe to call often.
export async function flushPendingDowngrade(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pendingDowngradeAt: true },
  });
  if (!user?.pendingDowngradeAt) return false;
  if (await userHasMatchInProgress(userId)) return false;
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: "FREE",
      stripeSubscriptionId: null,
      planExpiresAt: null,
      pendingDowngradeAt: null,
    },
  });
  console.info(`[billing] deferred downgrade applied for ${userId}: the match ended`);
  return true;
}

// Every coach whose downgrade was waiting on a team that has just finished a
// match. Called when a match is finalised.
export async function flushPendingDowngradesForTeam(teamId: string): Promise<number> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { coachId: true, clubId: true },
  });
  if (!team) return 0;
  const ids = new Set<string>([team.coachId]);
  if (team.clubId) {
    const owners = await prisma.clubMember.findMany({
      where: { clubId: team.clubId, role: "OWNER" },
      select: { userId: true },
    });
    for (const o of owners) ids.add(o.userId);
  }
  let applied = 0;
  for (const id of ids) if (await flushPendingDowngrade(id)) applied += 1;
  return applied;
}

// ---------------------------------------------------------------------------
// Reconcile against Stripe
// ---------------------------------------------------------------------------

export type ReconcileOutcome =
  | "not-configured"
  | "no-customer"
  | "cached"
  | "in-sync"
  | "corrected"
  | "deferred-live-match"
  | "error";

export interface ReconcileResult {
  outcome: ReconcileOutcome;
  plan: Plan;
  status: string | null;
  message: string;
}

// One lookup per user per minute is enough to keep a page load honest without
// putting a Stripe round trip on every render.
const CACHE_MS = 60_000;
const lastChecked = new Map<string, number>();

export function resetReconcileCache() {
  lastChecked.clear();
}

export async function reconcileUserPlan(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<ReconcileResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, stripeId: true, subscriptionStatus: true },
  });
  const current: Plan = user?.plan ?? "FREE";

  if (!isStripeConfigured()) {
    return { outcome: "not-configured", plan: current, status: user?.subscriptionStatus ?? null, message: "Billing is not configured on this server." };
  }
  if (!user?.stripeId) {
    // Nothing has ever been paid, so there is nothing to reconcile.
    return { outcome: "no-customer", plan: current, status: null, message: "No Stripe customer for this account yet." };
  }

  const now = Date.now();
  if (!opts.force && now - (lastChecked.get(userId) ?? 0) < CACHE_MS) {
    return { outcome: "cached", plan: current, status: user.subscriptionStatus, message: "Checked with Stripe in the last minute." };
  }
  lastChecked.set(userId, now);

  try {
    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({
      customer: user.stripeId,
      status: "all",
      limit: 10,
    });
    // The one that still grants access wins; otherwise the most recent.
    const live = subs.data.find((s) => statusKeepsAccess(s.status));
    const chosen = live ?? subs.data[0] ?? null;

    const next: PlanWrite = chosen
      ? (() => {
          const { plan, status, cancelAt } = planFromSubscription(chosen);
          return { plan, status, subscriptionId: plan === "FREE" ? null : chosen.id, cancelAt };
        })()
      : { plan: "FREE", status: null, subscriptionId: null, cancelAt: null };

    if (next.plan === current && next.status === user.subscriptionStatus) {
      return { outcome: "in-sync", plan: current, status: next.status, message: "Your plan matches Stripe." };
    }

    const result = await applyPlan(userId, next);
    if (!result.applied) {
      return {
        outcome: "deferred-live-match",
        plan: result.plan,
        status: next.status,
        message: "A match is in progress, so nothing about your plan changes until it ends.",
      };
    }
    console.info(
      `[billing] reconciled ${userId}: ${current} -> ${next.plan} (Stripe status ${next.status ?? "none"})`,
    );
    return {
      outcome: "corrected",
      plan: next.plan,
      status: next.status,
      message:
        next.plan === "FREE"
          ? "Stripe shows no active subscription, so your plan has been set to Free."
          : `Stripe shows an active subscription. Your plan is now ${next.plan === "CLUB" ? "Club" : "Coach Pro"}.`,
    };
  } catch (err) {
    console.error(`[billing] reconcile failed for ${userId}:`, err);
    return { outcome: "error", plan: current, status: user.subscriptionStatus, message: "Could not reach Stripe just now. Your plan is unchanged." };
  }
}

// ---------------------------------------------------------------------------
// Webhook idempotency
// ---------------------------------------------------------------------------

// A delivery that has crashed part way through leaves its row behind. After
// this long, a retry is allowed to pick it up again.
const STUCK_AFTER_MS = 5 * 60_000;

// Claims an event for handling. False means it is already done, or another
// delivery of the same event is in flight right now.
//
// The row is written before the work starts, so two simultaneous deliveries
// cannot both run. It is only marked done on success, so a handler that throws
// or a process that dies leaves the event available to Stripe's next retry
// instead of silently swallowing it.
export async function claimStripeEvent(id: string, type: string): Promise<boolean> {
  const existing = await prisma.stripeEvent.findUnique({
    where: { id },
    select: { status: true, receivedAt: true },
  });
  if (existing) {
    if (existing.status === "ok") return false;
    const stuck = Date.now() - existing.receivedAt.getTime() > STUCK_AFTER_MS;
    if (existing.status === "processing" && !stuck) return false;
    await prisma.stripeEvent.update({
      where: { id },
      data: { status: "processing", error: null, receivedAt: new Date() },
    });
    return true;
  }
  try {
    await prisma.stripeEvent.create({ data: { id, type, status: "processing" } });
    return true;
  } catch {
    return false; // raced with a concurrent delivery of the same event
  }
}

export async function markStripeEventDone(id: string): Promise<void> {
  await prisma.stripeEvent
    .update({ where: { id }, data: { status: "ok", error: null } })
    .catch(() => undefined);
}

export async function markStripeEventFailed(id: string, message: string): Promise<void> {
  await prisma.stripeEvent
    .update({ where: { id }, data: { status: "failed", error: message.slice(0, 500) } })
    .catch(() => undefined);
}
