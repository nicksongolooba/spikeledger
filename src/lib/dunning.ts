// What happens between a card failing and a club going dark.
//
// A club owner's card expires. Stripe moves the subscription to past_due and
// starts retrying. During that window the club keeps working in full, because
// the alternative is eight coaches losing access on a tournament morning for a
// billing problem none of them can fix.
//
// What the owner gets instead: an email the moment it fails, another after
// three days, another after six, and a banner in the app the whole time with
// the date the access ends. The invited coaches get nothing. They cannot
// update someone else's card, so telling them only causes alarm.

import { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appUrl, sendEmail } from "@/lib/email";

// How long the owner has before Stripe gives up. Stripe's own retry schedule
// runs to about two weeks on the default settings; this is what the banner and
// the emails quote so the owner sees one consistent date.
export const DUNNING_GRACE_DAYS = 14;

// Warning number 2 and 3, in days after the first failure.
const FOLLOW_UP_DAYS = [3, 6];

export function dunningDeadline(failedAt: Date): Date {
  return new Date(failedAt.getTime() + DUNNING_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

function formatDeadline(d: Date): string {
  return d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
}

// The link in every email and on the banner. It creates a fresh Stripe portal
// session on the way through, so a mail opened five days later still works.
export function updateCardUrl(): string {
  return `${appUrl()}/api/stripe/portal-redirect`;
}

export interface DunningState {
  failing: boolean;
  failedAt: Date | null;
  deadline: Date | null;
  deadlineLabel: string | null;
  plan: Plan;
  isClub: boolean;
}

// Only ever called for the account that holds the subscription, which is what
// keeps this off every invited coach's screen.
export async function dunningStateFor(userId: string): Promise<DunningState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, paymentFailedAt: true, subscriptionStatus: true },
  });
  const plan = user?.plan ?? "FREE";
  if (!user?.paymentFailedAt || user.subscriptionStatus !== "past_due") {
    return { failing: false, failedAt: null, deadline: null, deadlineLabel: null, plan, isClub: plan === "CLUB" };
  }
  const deadline = dunningDeadline(user.paymentFailedAt);
  return {
    failing: true,
    failedAt: user.paymentFailedAt,
    deadline,
    deadlineLabel: formatDeadline(deadline),
    plan,
    isClub: plan === "CLUB",
  };
}

export function paymentFailedEmail(args: {
  name: string | null;
  isClub: boolean;
  deadlineLabel: string;
  attempt: number; // 1, 2 or 3
  url: string;
}) {
  const who = args.name?.split(" ")[0];
  const greeting = who ? `Hi ${who},` : "Hi,";
  const what = args.isClub
    ? "your club's SpikeLedger subscription"
    : "your SpikeLedger Coach Pro subscription";
  const stakes = args.isClub
    ? "Your coaches keep full access while this is sorted out. If the payment is still not through by then, the club goes dormant: every coach keeps their own teams, players and stats, and the club comes back exactly as it was when you subscribe again."
    : "You keep full access while this is sorted out. If the payment is still not through by then, your account moves to the free plan. Nothing you have recorded is deleted.";
  const opener =
    args.attempt === 1
      ? `The card on file for ${what} was declined.`
      : args.attempt === 2
        ? `The card on file for ${what} is still declining. This is the second time we have written.`
        : `The card on file for ${what} has not gone through yet, and time is running short.`;

  const subject =
    args.attempt === 1
      ? "Your SpikeLedger payment did not go through"
      : `Reminder: update your card by ${args.deadlineLabel}`;

  const text = [
    greeting,
    "",
    opener,
    "",
    `The card will be retried a few more times. Access continues until ${args.deadlineLabel}.`,
    "",
    stakes,
    "",
    `Update your card: ${args.url}`,
    "",
    "If you have already fixed this, you can ignore this email.",
    "",
    "SpikeLedger",
  ].join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#0b1524">
  <p>${greeting}</p>
  <p>${opener}</p>
  <p>The card will be retried a few more times. Access continues until <strong>${args.deadlineLabel}</strong>.</p>
  <p>${stakes}</p>
  <p><a href="${args.url}" style="display:inline-block;background:#0b1a33;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Update your card</a></p>
  <p style="color:#63718a;font-size:13px">If you have already fixed this, you can ignore this email.</p>
  <p style="color:#63718a;font-size:13px">SpikeLedger</p>
</div>`;

  return { subject, text, html };
}

// Sends one warning if one is due. Returns the attempt number sent, or 0.
export async function sendDunningEmailIfDue(userId: string, now: Date = new Date()): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      paymentFailedAt: true,
      dunningEmailsSent: true,
    },
  });
  if (!user?.paymentFailedAt) return 0;
  // A card that has been fixed, or a subscription that is already gone, gets
  // no more reminders.
  if (user.subscriptionStatus !== "past_due" || user.plan === "FREE") return 0;

  const sent = user.dunningEmailsSent;
  if (sent >= 3) return 0;

  const daysSince = (now.getTime() - user.paymentFailedAt.getTime()) / (24 * 60 * 60 * 1000);
  const attempt = sent + 1;
  // Warning 1 goes immediately; 2 and 3 wait for their day to arrive.
  if (attempt > 1 && daysSince < FOLLOW_UP_DAYS[attempt - 2]) return 0;

  const body = paymentFailedEmail({
    name: user.name,
    isClub: user.plan === "CLUB",
    deadlineLabel: formatDeadline(dunningDeadline(user.paymentFailedAt)),
    attempt,
    url: updateCardUrl(),
  });

  const result = await sendEmail({
    to: user.email,
    subject: body.subject,
    text: body.text,
    html: body.html,
    // One send per user per failure per attempt, even if this runs twice.
    idempotencyKey: `dunning:${userId}:${user.paymentFailedAt.getTime()}:${attempt}`,
  });
  if (!result.ok && result.message !== "email_not_configured") {
    console.error(`[billing] dunning email ${attempt} failed for ${userId}: ${result.message}`);
    return 0;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { dunningEmailsSent: attempt, lastDunningEmailAt: now },
  });
  console.info(`[billing] dunning email ${attempt} sent for ${userId}`);
  return attempt;
}

// Every account with a warning due right now. Driven by a scheduled call to
// /api/cron/dunning, and safe to run as often as you like.
export async function sendDueDunningEmails(now: Date = new Date()): Promise<number> {
  const due = await prisma.user.findMany({
    where: {
      subscriptionStatus: "past_due",
      paymentFailedAt: { not: null },
      dunningEmailsSent: { lt: 3 },
      plan: { not: "FREE" },
    },
    select: { id: true },
    take: 200,
  });
  let sent = 0;
  for (const u of due) if (await sendDunningEmailIfDue(u.id, now)) sent += 1;
  return sent;
}

// Recorded the first time a payment fails; left alone on later failures for
// the same card so the three-email schedule keeps its original clock.
export async function recordPaymentFailure(customerId: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { stripeId: customerId },
    select: { id: true, paymentFailedAt: true },
  });
  if (!user) return null;
  if (!user.paymentFailedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { paymentFailedAt: new Date(), dunningEmailsSent: 0, lastDunningEmailAt: null },
    });
  }
  return user.id;
}
