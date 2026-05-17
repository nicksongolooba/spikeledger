import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APP_URL, getStripe, isStripeConfigured } from "@/lib/stripe";
import { PLAN_PRICING } from "@/lib/plan-limits";

const BodySchema = z.object({
  plan: z.enum(["COACH_PRO", "CLUB"]),
  interval: z.enum(["month", "year"]),
});

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured on this server." },
      { status: 503 },
    );
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const pricing = PLAN_PRICING[parsed.data.plan];
  const priceId =
    parsed.data.interval === "month"
      ? pricing.monthlyPriceId
      : pricing.yearlyPriceId;
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price ID for ${parsed.data.plan} (${parsed.data.interval}) is not set.` },
      { status: 503 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const stripe = getStripe();

  // Reuse the Stripe customer if we created one previously.
  let customerId = user.stripeId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeId: customerId },
    });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings/billing?success=true`,
    cancel_url: `${APP_URL}/settings/billing?canceled=true`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: user.id, plan: parsed.data.plan },
    },
    metadata: { userId: user.id, plan: parsed.data.plan },
  });

  return NextResponse.json({ url: checkout.url });
}
