import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { applyPlan, planFromMetadata } from "@/lib/billing-sync";

// POST /api/stripe/confirm  { sessionId }
//
// The first of the three paths that can set a plan, and the fastest. Stripe
// redirects back from Checkout with the session id in the URL; this retrieves
// that session directly and, if it is paid, sets the plan on the spot. No
// webhook involved.
//
// Idempotent by construction: it writes exactly what Stripe says, so the
// webhook arriving a second later writes the same thing again and nothing
// moves.
const BodySchema = z.object({ sessionId: z.string().min(10).max(200) });

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured on this server." }, { status: 503 });
  }
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session id" }, { status: 400 });

  try {
    const checkout = await getStripe().checkout.sessions.retrieve(parsed.data.sessionId);

    // The session must belong to this account. A pasted session id from
    // somewhere else grants nothing.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeId: true, plan: true } });
    const customerId = typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id;
    const ownedByMetadata = checkout.metadata?.userId === userId;
    if (!ownedByMetadata && (!customerId || customerId !== user?.stripeId)) {
      return NextResponse.json({ error: "That checkout session is not yours." }, { status: 403 });
    }

    if (checkout.payment_status !== "paid") {
      return NextResponse.json({
        activated: false,
        paymentStatus: checkout.payment_status,
        plan: user?.plan ?? "FREE",
      });
    }

    const subscriptionId =
      typeof checkout.subscription === "string" ? checkout.subscription : checkout.subscription?.id ?? null;
    const result = await applyPlan(userId, {
      plan: planFromMetadata(checkout.metadata),
      status: "active",
      subscriptionId,
      cancelAt: null,
    });
    console.info(`[billing] checkout confirmed at redirect for ${userId}: ${result.plan}`);
    return NextResponse.json({ activated: true, plan: result.plan, paymentStatus: checkout.payment_status });
  } catch (err) {
    console.error(`[billing] checkout confirm failed for ${userId}:`, err);
    return NextResponse.json({ error: "Could not confirm the payment with Stripe just now." }, { status: 502 });
  }
}
