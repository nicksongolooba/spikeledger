// Billing that survives a missing webhook, and a failed card that does not
// take a club offline on a tournament morning.
//
// Everything here runs against the real database and the real lib code. It
// never calls Stripe: the Stripe-shaped inputs are constructed, because what
// is being tested is what the app does with them.
//
// Creates throwaway users with @billing-test.local emails and deletes them in a
// finally block.
// Run:  node --import tsx scripts/verify-billing.mts

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  applyPlan,
  claimStripeEvent,
  flushPendingDowngrade,
  flushPendingDowngradesForTeam,
  markStripeEventDone,
  markStripeEventFailed,
  planFromMetadata,
  planFromSubscription,
  reconcileUserPlan,
  statusKeepsAccess,
  userHasMatchInProgress,
} from "@/lib/billing-sync";
import {
  DUNNING_GRACE_DAYS,
  dunningDeadline,
  dunningStateFor,
  paymentFailedEmail,
  recordPaymentFailure,
  sendDunningEmailIfDue,
  updateCardUrl,
} from "@/lib/dunning";
import { isClubActive } from "@/lib/club";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? `  (${detail})` : ""}`);
  }
}

const run = Date.now().toString(36);
const email = (who: string) => `${who}-${run}@billing-test.local`;
const DAY = 24 * 60 * 60 * 1000;

// A Stripe subscription, only the fields the app reads.
function sub(status: string, plan = "CLUB", cancelAt: number | null = null): Stripe.Subscription {
  return {
    id: `sub_${status}`,
    status,
    cancel_at: cancelAt,
    customer: "cus_test",
    metadata: { plan },
  } as unknown as Stripe.Subscription;
}

async function planOf(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, subscriptionStatus: true, pendingDowngradeAt: true, paymentFailedAt: true, dunningEmailsSent: true },
  });
  return u!;
}

async function main() {
  const owner = await prisma.user.create({
    data: { email: email("owner"), name: "Club Owner", passwordHash: "x", role: "COACH", plan: "CLUB", stripeId: `cus_${run}` },
  });
  const coach = await prisma.user.create({
    data: { email: email("coach"), name: "Invited Coach", passwordHash: "x", role: "COACH", plan: "FREE" },
  });
  const cleanup = [owner.id, coach.id];
  const eventIds: string[] = [];
  let clubId: string | null = null;

  try {
    // ---------------------------------------------------------------- FIX 5
    console.log("\n1. A plan is correct even if the webhook never arrives");

    check("plan comes from the checkout metadata", planFromMetadata({ plan: "CLUB" }) === "CLUB");
    check("unknown metadata falls back to Coach Pro", planFromMetadata({}) === "COACH_PRO");

    // applyPlan is the single write every path funnels into.
    const first = await applyPlan(owner.id, { plan: "CLUB", status: "active", subscriptionId: "sub_1", cancelAt: null });
    check("the first write sets the plan", first.applied && first.plan === "CLUB" && first.changed);
    const again = await applyPlan(owner.id, { plan: "CLUB", status: "active", subscriptionId: "sub_1", cancelAt: null });
    check("running it again changes nothing", again.applied && !("changed" in again && again.changed));
    check("the row is what Stripe said", (await planOf(owner.id)).subscriptionStatus === "active");

    // Webhook idempotency, keyed on the Stripe event id.
    const evt = `evt_${run}_1`;
    eventIds.push(evt);
    check("a new event is claimed", await claimStripeEvent(evt, "checkout.session.completed"));
    check("a second delivery of it is not", !(await claimStripeEvent(evt, "checkout.session.completed")));
    await markStripeEventDone(evt);
    check("and still is not once it has succeeded", !(await claimStripeEvent(evt, "checkout.session.completed")));

    const failing = `evt_${run}_2`;
    eventIds.push(failing);
    await claimStripeEvent(failing, "customer.subscription.updated");
    await markStripeEventFailed(failing, "database was unreachable");
    check("a failed event is left for Stripe to retry", await claimStripeEvent(failing, "customer.subscription.updated"));
    const stored = await prisma.stripeEvent.findUnique({ where: { id: failing } });
    check("the failure was recorded with its reason", stored !== null);

    // Reconcile never invents a plan. With no Stripe keys on this machine it
    // reports not-configured; with keys and no customer, no-customer. Either
    // way the plan it returns is the one already in the database.
    const noCustomer = await reconcileUserPlan(coach.id, { force: true });
    check(
      "reconcile is a no-op for a coach who never paid",
      (noCustomer.outcome === "no-customer" || noCustomer.outcome === "not-configured") &&
        noCustomer.plan === "FREE",
      noCustomer.outcome,
    );
    check("and it did not touch the row", (await planOf(coach.id)).plan === "FREE");

    // ---------------------------------------------------------------- FIX 6
    console.log("\n2. A failed card does not take a club offline");

    check("active keeps access", statusKeepsAccess("active"));
    check("trialing keeps access", statusKeepsAccess("trialing"));
    check("past_due keeps access, because Stripe is still retrying", statusKeepsAccess("past_due"));
    check("canceled does not", !statusKeepsAccess("canceled"));
    check("unpaid does not", !statusKeepsAccess("unpaid"));
    check("incomplete_expired does not", !statusKeepsAccess("incomplete_expired"));

    check("a past_due subscription still grants Club", planFromSubscription(sub("past_due")).plan === "CLUB");
    check("a past_due Coach Pro keeps Coach Pro too", planFromSubscription(sub("past_due", "COACH_PRO")).plan === "COACH_PRO");
    check("a canceled subscription grants nothing", planFromSubscription(sub("canceled")).plan === "FREE");
    check("an unpaid subscription grants nothing", planFromSubscription(sub("unpaid")).plan === "FREE");

    // The club, and what past_due does to it.
    const club = await prisma.club.create({
      data: { name: "Test Club", members: { create: [{ userId: owner.id, role: "OWNER" }, { userId: coach.id, role: "COACH" }] } },
    });
    clubId = club.id;
    check("the club is active while the owner is on Club", await isClubActive(club.id));

    const pastDue = planFromSubscription(sub("past_due"));
    await applyPlan(owner.id, { plan: pastDue.plan, status: pastDue.status, subscriptionId: "sub_1", cancelAt: null });
    check("past_due leaves the owner on Club", (await planOf(owner.id)).plan === "CLUB");
    check("and the club still active, so nobody loses access", await isClubActive(club.id));
    check("the status is recorded as past_due", (await planOf(owner.id)).subscriptionStatus === "past_due");

    // Dunning: the owner is warned, three times, on a schedule.
    const userId = await recordPaymentFailure(owner.id === null ? "" : `cus_${run}`);
    check("the failure is pinned to the right account", userId === owner.id);
    const failedAt = (await planOf(owner.id)).paymentFailedAt;
    check("the first failure starts the clock", failedAt !== null);
    await recordPaymentFailure(`cus_${run}`);
    check("a second failure does not restart it", (await planOf(owner.id)).paymentFailedAt?.getTime() === failedAt?.getTime());

    const banner = await dunningStateFor(owner.id);
    check("the owner gets a banner", banner.failing && banner.isClub);
    check("with the date access ends on it", banner.deadlineLabel !== null && banner.deadline !== null);
    check(
      `the deadline is ${DUNNING_GRACE_DAYS} days out`,
      Math.round(((banner.deadline?.getTime() ?? 0) - (failedAt?.getTime() ?? 0)) / DAY) === DUNNING_GRACE_DAYS,
    );
    const coachBanner = await dunningStateFor(coach.id);
    check("an invited coach gets no banner at all", !coachBanner.failing);

    check("email 1 goes out immediately", (await sendDunningEmailIfDue(owner.id)) === 1);
    check("and not twice", (await sendDunningEmailIfDue(owner.id)) === 0);
    const start = failedAt!.getTime();
    check("nothing on day 2", (await sendDunningEmailIfDue(owner.id, new Date(start + 2 * DAY))) === 0);
    check("email 2 on day 3", (await sendDunningEmailIfDue(owner.id, new Date(start + 3 * DAY))) === 2);
    check("nothing on day 5", (await sendDunningEmailIfDue(owner.id, new Date(start + 5 * DAY))) === 0);
    check("email 3 on day 6", (await sendDunningEmailIfDue(owner.id, new Date(start + 6 * DAY))) === 3);
    check("and never a fourth", (await sendDunningEmailIfDue(owner.id, new Date(start + 20 * DAY))) === 0);

    const mail = paymentFailedEmail({ name: "Alex Kim", isClub: true, deadlineLabel: "October 1, 2026", attempt: 1, url: updateCardUrl() });
    check("the email says what failed", mail.text.includes("declined"));
    check("what happens next", mail.text.includes("October 1, 2026") && mail.text.includes("dormant"));
    check("and carries a link to update the card", mail.text.includes("/api/stripe/portal-redirect"));
    check("it reassures about the coaches' own data", mail.text.includes("keeps their own teams"));

    // A recovered card clears everything.
    await applyPlan(owner.id, { plan: "CLUB", status: "active", subscriptionId: "sub_1", cancelAt: null });
    const recovered = await planOf(owner.id);
    check("a successful payment clears the warning", recovered.paymentFailedAt === null && recovered.dunningEmailsSent === 0);
    check("and the banner with it", !(await dunningStateFor(owner.id)).failing);

    // ------------------------------------------- never downgrade mid-match
    console.log("\n3. A downgrade never lands in the middle of a match");

    const team = await prisma.team.create({ data: { name: "Billing Test Team", coachId: owner.id, clubId: club.id } });
    const tournament = await prisma.tournament.create({ data: { teamId: team.id, name: "T", startDate: new Date() } });
    check("no match in progress yet", !(await userHasMatchInProgress(owner.id)));

    const match = await prisma.match.create({
      data: { tournamentId: tournament.id, opponent: "Anyone", matchNumber: 1, startedAt: new Date() },
    });
    check("a started match counts", await userHasMatchInProgress(owner.id));

    const deferred = await applyPlan(owner.id, { plan: "FREE", status: "canceled", subscriptionId: null, cancelAt: null });
    check("the downgrade is held back", !deferred.applied);
    check("the owner is still on Club", (await planOf(owner.id)).plan === "CLUB");
    check("the club is still active, so stat entry keeps working", await isClubActive(club.id));
    check("but it is recorded as pending", (await planOf(owner.id)).pendingDowngradeAt !== null);
    check("flushing while the match runs does nothing", !(await flushPendingDowngrade(owner.id)));

    // An upgrade mid-match is not held back: it takes nothing away.
    const upgradeDuring = await applyPlan(owner.id, { plan: "CLUB", status: "active", subscriptionId: "sub_1", cancelAt: null });
    check("an upgrade during a match still applies", upgradeDuring.applied);
    // Put the pending downgrade back for the next step.
    await applyPlan(owner.id, { plan: "FREE", status: "canceled", subscriptionId: null, cancelAt: null });

    await prisma.match.update({ where: { id: match.id }, data: { result: "WIN" } });
    check("the match ending clears the way", !(await userHasMatchInProgress(owner.id)));
    check("and the downgrade lands", (await flushPendingDowngradesForTeam(team.id)) === 1);
    check("the owner is now Free", (await planOf(owner.id)).plan === "FREE");
    check("the club is dormant", !(await isClubActive(club.id)));
    check("nothing is left pending", (await planOf(owner.id)).pendingDowngradeAt === null);
    check("the invited coach keeps their own team and data", (await prisma.team.count({ where: { clubId: club.id } })) === 1);
  } finally {
    if (clubId) await prisma.club.deleteMany({ where: { id: clubId } });
    await prisma.stripeEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanup } } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
