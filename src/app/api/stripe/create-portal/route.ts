import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APP_URL, getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured on this server." },
      { status: 503 },
    );
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.stripeId) {
    return NextResponse.json(
      { error: "No Stripe customer for this user yet." },
      { status: 400 },
    );
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: user.stripeId,
    return_url: `${APP_URL}/settings/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
