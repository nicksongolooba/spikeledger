import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getStripe,
  getWebhookSecret,
  isStripeConfigured,
  isWebhookConfigured,
} from "@/lib/stripe";

// Stripe sends raw bytes - Next 14 App Router gives us req.text() which we
// pass to stripe.webhooks.constructEvent for signature verification.
export const dynamic = "force-dynamic";

function planFromMetadata(meta: Stripe.Metadata | null | undefined): Plan {
  const v = meta?.plan;
  if (v === "COACH_PRO" || v === "CLUB") return v;
  return "COACH_PRO";
}

async function updatePlanForCustomer(
  customerId: string,
  plan: Plan,
  subscriptionId: string | null,
  cancelAt: Date | null,
) {
  const user = await prisma.user.findFirst({ where: { stripeId: customerId } });
  if (!user) return;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      stripeSubscriptionId: subscriptionId,
      planExpiresAt: cancelAt,
    },
  });
}

export async function POST(req: Request) {
  if (!isStripeConfigured() || !isWebhookConfigured()) {
    // Return 200 so Stripe doesn't retry forever when keys aren't set up yet -
    // log a hint and move on.
    console.warn("Stripe webhook received but billing is not configured.");
    return new NextResponse("Billing not configured", { status: 200 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      getWebhookSecret(),
    );
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.customer && session.subscription) {
        const plan = planFromMetadata(session.metadata as Stripe.Metadata);
        await updatePlanForCustomer(
          session.customer as string,
          plan,
          session.subscription as string,
          null,
        );
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const plan = planFromMetadata(sub.metadata);
      const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000) : null;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      // Active/trialing/past_due still keep the plan; canceled = downgrade.
      if (sub.status === "canceled" || sub.status === "incomplete_expired") {
        await updatePlanForCustomer(customerId, "FREE", null, null);
      } else {
        await updatePlanForCustomer(customerId, plan, sub.id, cancelAt);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await updatePlanForCustomer(customerId, "FREE", null, null);
      break;
    }
    case "invoice.payment_failed": {
      // Flag the account - for now we just log; email is future work.
      const invoice = event.data.object as Stripe.Invoice;
      console.warn("Payment failed for customer", invoice.customer);
      break;
    }
    default:
      // Ignored: we only care about the subscription lifecycle.
      break;
  }

  return NextResponse.json({ received: true });
}
