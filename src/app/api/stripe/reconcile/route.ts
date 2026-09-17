import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { flushPendingDowngrade, reconcileUserPlan } from "@/lib/billing-sync";

// POST /api/stripe/reconcile
//
// The escape hatch. Behind the "Refresh my plan" button, and polled by the
// billing page after a checkout redirect. Forces a fresh Stripe lookup and
// reports what it found, in words a coach can act on.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  await flushPendingDowngrade(userId).catch(() => undefined);
  const result = await reconcileUserPlan(userId, { force: body.force !== false });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, subscriptionStatus: true, planExpiresAt: true },
  });

  return NextResponse.json({
    outcome: result.outcome,
    message: result.message,
    plan: user?.plan ?? result.plan,
    status: user?.subscriptionStatus ?? result.status,
    planExpiresAt: user?.planExpiresAt?.toISOString() ?? null,
  });
}
