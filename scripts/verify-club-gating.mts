// Club plan gating, against the real database and the real lib code.
//
// The rule under test: club tools are CLUB tier only, and a club whose owner
// no longer holds the CLUB plan goes DORMANT rather than being deleted. A
// dormant club grants nothing, and every coach keeps everything they created.
//
// Creates throwaway users with @clubgating-test.local emails and deletes them
// in a finally block.
// Run:  node --import tsx scripts/verify-club-gating.mts

import { prisma } from "@/lib/prisma";
import {
  ClubError,
  acceptInvite,
  clubGrantedPlan,
  createInvite,
  ensureClubForOwner,
  getClubAccess,
  getEffectivePlan,
  higherPlan,
  isClubActive,
  requireClubOwner,
} from "@/lib/club";
import { getTeamAccessLevel, teamVisibleWhere } from "@/lib/access";
import { PLAN_LIMITS } from "@/lib/plan-limits";

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

// Runs fn and reports the ClubError it threw, or null if it did not throw.
async function clubError(fn: () => Promise<unknown>): Promise<ClubError | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof ClubError) return e;
    throw e;
  }
}

const run = Date.now().toString(36);
const email = (who: string) => `${who}-${run}@clubgating-test.local`;

async function visibleTeamIds(userId: string): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: teamVisibleWhere(userId),
    select: { id: true },
  });
  return teams.map((t) => t.id);
}

async function main() {
  const owner = await prisma.user.create({
    data: { email: email("owner"), name: "Club Owner", passwordHash: "x", role: "COACH", plan: "CLUB" },
  });
  const proCoach = await prisma.user.create({
    data: { email: email("pro"), name: "Pro Coach", passwordHash: "x", role: "COACH", plan: "COACH_PRO" },
  });
  const freeCoach = await prisma.user.create({
    data: { email: email("free"), name: "Free Coach", passwordHash: "x", role: "COACH", plan: "FREE" },
  });
  const outsider = await prisma.user.create({
    data: { email: email("outsider"), name: "Outside Pro", passwordHash: "x", role: "COACH", plan: "COACH_PRO" },
  });
  const cleanup = [owner.id, proCoach.id, freeCoach.id, outsider.id];
  let createdClubId: string | null = null;

  try {
    // 1. Plan ranking
    console.log("\n1. Plan ranking");
    check("CLUB beats COACH_PRO", higherPlan("COACH_PRO", "CLUB") === "CLUB");
    check("COACH_PRO beats FREE", higherPlan("COACH_PRO", "FREE") === "COACH_PRO");
    check("a club never moves a paying coach down", higherPlan("COACH_PRO", "FREE") === "COACH_PRO");
    check("Club plan allows more coaches than Coach Pro", PLAN_LIMITS.CLUB.maxCoaches > PLAN_LIMITS.COACH_PRO.maxCoaches);

    // 2. The reported bug: Coach Pro with no club sees no club tools
    console.log("\n2. A Coach Pro user with no club");
    check("effective plan stays Coach Pro", (await getEffectivePlan(outsider.id)) === "COACH_PRO");
    const outsiderAccess = await getClubAccess(outsider.id);
    check("club access refused", !outsiderAccess.allowed);
    check("refused for the right reason", outsiderAccess.reason === "no-plan", outsiderAccess.reason);
    check("no club is created for them", (await ensureClubForOwner(outsider.id)) === null);
    const outsiderInvite = await clubError(() => createInvite(outsider.id, "someone@example.com"));
    check("invite API refuses them with 403", outsiderInvite?.status === 403, String(outsiderInvite?.status));
    check("the refusal names the plan, not the role", (outsiderInvite?.message ?? "").includes("Club plan"));

    // 3. An active club
    console.log("\n3. An active club");
    const membership = await ensureClubForOwner(owner.id);
    check("the Club plan creates the club on first visit", membership?.role === "OWNER");
    const clubId = membership!.club.id;
    createdClubId = clubId;
    check("a club with a paying owner is active", await isClubActive(clubId));

    // Both coaches join.
    for (const user of [proCoach, freeCoach]) {
      const { code } = await createInvite(owner.id, user.email);
      await acceptInvite(code, user.id);
    }
    check("owner can invite while the club is active", (await prisma.clubMember.count({ where: { clubId } })) === 3);
    check("the Free coach is lent Club tier", (await getEffectivePlan(freeCoach.id)) === "CLUB");
    check("the Coach Pro coach is lent Club tier too", (await getEffectivePlan(proCoach.id)) === "CLUB");
    check("club access allowed for a member", (await getClubAccess(proCoach.id)).allowed);
    check("a member who is not the owner still cannot invite", (await clubError(() => createInvite(proCoach.id, "x@example.com")))?.message.includes("owner") === true);

    // Teams, and owner oversight over them.
    const ownerTeam = await prisma.team.create({
      data: { name: "Owner Team", coachId: owner.id, clubId },
    });
    const proTeam = await prisma.team.create({
      data: { name: "Pro Coach Team", coachId: proCoach.id, clubId },
    });
    const outsideTeam = await prisma.team.create({
      data: { name: "Outsider Team", coachId: outsider.id },
    });
    let ownerSees = await visibleTeamIds(owner.id);
    check("the owner oversees every team in the active club", ownerSees.includes(proTeam.id) && ownerSees.includes(ownerTeam.id));
    check("the owner never sees teams outside the club", !ownerSees.includes(outsideTeam.id));
    check("oversight is read-only", (await getTeamAccessLevel(proTeam.id, owner.id)) === "read");
    check("a coach manages their own team", (await getTeamAccessLevel(proTeam.id, proCoach.id)) === "manage");
    check("a coach does not see the owner's team", !(await visibleTeamIds(proCoach.id)).includes(ownerTeam.id));

    // A pending invite, left open across the downgrade.
    const { code: pendingCode } = await createInvite(owner.id, "later@example.com");

    // 4. The owner downgrades
    console.log("\n4. The owner downgrades to Coach Pro");
    await prisma.user.update({ where: { id: owner.id }, data: { plan: "COACH_PRO" } });

    check("the club is now dormant", !(await isClubActive(clubId)));
    check("the club row is still there", (await prisma.club.count({ where: { id: clubId } })) === 1);
    check("nobody was removed from the club", (await prisma.clubMember.count({ where: { clubId } })) === 3);
    check("teams keep their club link", (await prisma.team.findUnique({ where: { id: proTeam.id }, select: { clubId: true } }))?.clubId === clubId);

    // Access is gone for everyone, including the owner.
    const downgradedOwner = await getClubAccess(owner.id);
    check("the downgraded owner loses club access", !downgradedOwner.allowed);
    check("and is told the club is dormant", downgradedOwner.reason === "dormant", downgradedOwner.reason);
    check("the owner's own plan is what is left", (await getEffectivePlan(owner.id)) === "COACH_PRO");
    check("membership alone lends nothing now", (await clubGrantedPlan(proCoach.id)) === "FREE");
    check("an invited Coach Pro falls back to Coach Pro", (await getEffectivePlan(proCoach.id)) === "COACH_PRO");
    check("an invited Free coach falls back to Free", (await getEffectivePlan(freeCoach.id)) === "FREE");
    check("an invited coach loses club access", !(await getClubAccess(proCoach.id)).allowed);
    check("the sidebar gate agrees", (await getClubAccess(freeCoach.id)).reason === "dormant");

    // Coaches keep their own work, in full.
    check("the invited coach still has their team", (await visibleTeamIds(proCoach.id)).includes(proTeam.id));
    check("and still manages it", (await getTeamAccessLevel(proTeam.id, proCoach.id)) === "manage");
    check("the owner still has their own team", (await visibleTeamIds(owner.id)).includes(ownerTeam.id));

    // Club-shared access is what stops.
    ownerSees = await visibleTeamIds(owner.id);
    check("oversight of other coaches' teams stops", !ownerSees.includes(proTeam.id));
    check("and the read level with it", (await getTeamAccessLevel(proTeam.id, owner.id)) === null);

    // Club writes are refused.
    const dormantInvite = await clubError(() => createInvite(owner.id, "nope@example.com"));
    check("a dormant club cannot invite coaches", dormantInvite?.status === 403);
    check("the message explains dormancy and the way back", (dormantInvite?.message ?? "").includes("dormant") && (dormantInvite?.message ?? "").includes("again"));
    const dormantOwnerCheck = await clubError(() => requireClubOwner(owner.id, "Only the club owner can edit club settings."));
    check("club settings are refused too", dormantOwnerCheck?.status === 403);
    check("the club setup door is shut", (await ensureClubForOwner(owner.id)) === null);
    const dormantAccept = await clubError(() => acceptInvite(pendingCode, outsider.id));
    check("a pending invite stops working while dormant", dormantAccept?.status === 403, String(dormantAccept?.status));
    check("and nobody was added by the attempt", (await prisma.clubMember.count({ where: { clubId } })) === 3);
    check("the invite itself is not deleted", (await prisma.clubInvite.count({ where: { code: pendingCode } })) === 1);

    // 5. Re-subscribing restores everything
    console.log("\n5. The owner subscribes again");
    await prisma.user.update({ where: { id: owner.id }, data: { plan: "CLUB" } });
    check("the club is active again", await isClubActive(clubId));
    check("the owner has club access again", (await getClubAccess(owner.id)).allowed);
    check("members are lent Club tier again", (await getEffectivePlan(freeCoach.id)) === "CLUB");
    check("oversight comes back", (await visibleTeamIds(owner.id)).includes(proTeam.id));
    check("with the same teams attached, nothing rebuilt", (await prisma.team.count({ where: { clubId } })) === 2);
    const revived = await acceptInvite(pendingCode, outsider.id);
    check("the pending invite works again", revived.already === false);
    check("the outsider is now a member", (await prisma.clubMember.count({ where: { clubId } })) === 4);

    // 6. A downgrade to Free behaves the same way
    console.log("\n6. The owner drops to Free");
    await prisma.user.update({ where: { id: owner.id }, data: { plan: "FREE" } });
    check("the club is dormant again", !(await isClubActive(clubId)));
    check("the owner is Free, not Club", (await getEffectivePlan(owner.id)) === "FREE");
    check("no club access", !(await getClubAccess(owner.id)).allowed);
    check("members drop back again", (await getEffectivePlan(proCoach.id)) === "COACH_PRO");
    check("every coach still owns their own team", (await visibleTeamIds(proCoach.id)).includes(proTeam.id));
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: cleanup } } });
    // Only ever the club this run created: a blanket "delete empty clubs"
    // would reach real ones.
    if (createdClubId) await prisma.club.deleteMany({ where: { id: createdClubId } });
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
