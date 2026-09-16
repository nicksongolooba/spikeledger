import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APP_URL, getStripe, isStripeConfigured } from "@/lib/stripe";

// GET /api/stripe/portal-redirect
//
// The "Update your card" link in the payment-failed emails points here rather
// than at a Stripe portal URL, because a portal session made at send time has
// expired by the time someone opens the mail three days later. This makes a
// fresh one on the way through.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  // Not signed in: send them to log in, then back here.
  if (!userId) {
    return NextResponse.redirect(
      `${APP_URL}/login?callbackUrl=${encodeURIComponent("/api/stripe/portal-redirect")}`,
    );
  }
  if (!isStripeConfigured()) return NextResponse.redirect(`${APP_URL}/settings/billing`);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeId: true } });
  if (!user?.stripeId) return NextResponse.redirect(`${APP_URL}/settings/billing`);

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: user.stripeId,
      return_url: `${APP_URL}/settings/billing`,
    });
    return NextResponse.redirect(portal.url);
  } catch (err) {
    console.error(`[billing] portal redirect failed for ${userId}:`, err);
    return NextResponse.redirect(`${APP_URL}/settings/billing?portal=failed`);
  }
}
