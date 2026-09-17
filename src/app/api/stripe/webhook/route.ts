import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  getStripe,
  getWebhookSecret,
  isStripeConfigured,
  isWebhookConfigured,
} from "@/lib/stripe";
import {
  applyPlan,
  claimStripeEvent,
  markStripeEventDone,
  markStripeEventFailed,
  planFromMetadata,
  planFromSubscription,
} from "@/lib/billing-sync";
import { recordPaymentFailure, sendDunningEmailIfDue } from "@/lib/dunning";

// Stripe sends raw bytes - Next 14 App Router gives us req.text() which we
// pass to stripe.webhooks.constructEvent for signature verification.
//
// This is no longer the only way a plan gets set. The checkout redirect and
// the billing page both reconcile against Stripe directly, so a webhook that
// never arrives costs nobody their plan. What this still has to be is exactly
// once: Stripe retries on any non-2xx and on its own schedule, so every event
// is claimed by id before it is handled and a repeat is dropped.
export const dynamic = "force-dynamic";

async function customerIdOf(sub: Stripe.Subscription): Promise<string> {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

async function userIdForCustomer(customerId: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { stripeId: customerId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.customer || !session.subscription) break;
      const customerId = session.customer as string;
      const userId = await userIdForCustomer(customerId);
      if (!userId) break;
      await applyPlan(userId, {
        plan: planFromMetadata(session.metadata as Stripe.Metadata),
        status: "active",
        subscriptionId: session.subscription as string,
        cancelAt: null,
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await userIdForCustomer(await customerIdOf(sub));
      if (!userId) break;
      // past_due keeps the plan; canceled and unpaid do not. The rule lives in
      // planFromSubscription so every path agrees on it.
      const { plan, status, cancelAt } = planFromSubscription(sub);
      await applyPlan(userId, {
        plan,
        status,
        subscriptionId: plan === "FREE" ? null : sub.id,
        cancelAt,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await userIdForCustomer(await customerIdOf(sub));
      if (!userId) break;
      await applyPlan(userId, { plan: "FREE", status: "canceled", subscriptionId: null, cancelAt: null });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;
      // The subscription stays exactly where it is. Stripe is still retrying,
      // and a failed card must not take a club offline mid-tournament.
      const userId = await recordPaymentFailure(customerId);
      if (userId) await sendDunningEmailIfDue(userId);
      break;
    }

    case "invoice.payment_succeeded": {
      // A recovered card ends the dunning run. The subscription.updated event
      // that follows carries the real status; this just clears the warning.
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;
      const userId = await userIdForCustomer(customerId);
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { paymentFailedAt: null, dunningEmailsSent: 0, lastDunningEmailAt: null },
        });
      }
      break;
    }

    default:
      // Ignored: we only care about the subscription lifecycle.
      break;
  }
}

export async function POST(req: Request) {
  if (!isStripeConfigured() || !isWebhookConfigured()) {
    // Return 200 so Stripe doesn't retry forever when keys aren't set up yet.
    console.warn("[billing] webhook received but billing is not configured.");
    return new NextResponse("Billing not configured", { status: 200 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch (err) {
    console.error("[billing] webhook signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // Claimed before it is handled, so a retry arriving while the first is still
  // running is turned away too.
  const fresh = await claimStripeEvent(event.id, event.type);
  if (!fresh) {
    console.info(`[billing] webhook ${event.type} ${event.id} already handled, ignoring`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Every failure is logged with the event type and the Stripe event id, and
    // the row is left marked failed so the next retry is allowed through.
    console.error(`[billing] webhook FAILED type=${event.type} id=${event.id}: ${message}`);
    await markStripeEventFailed(event.id, message);
    return new NextResponse("Handler failed", { status: 500 });
  }

  await markStripeEventDone(event.id);
  return NextResponse.json({ received: true });
}
