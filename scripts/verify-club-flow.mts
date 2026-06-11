// End-to-end Club tier verification against the real DB and the real lib
// code (club.ts + access.ts). Creates throwaway users/club/teams with
// @clubflow-test.local emails, walks the full flow, and deletes everything
// in a finally block. Run:  node --import tsx scripts/verify-club-flow.mts

import { prisma } from "@/lib/prisma";
import {
  ensureClubForOwner,
  createInvite,
  acceptInvite,
  getEffectivePlan,
  getClubMembership,
  ClubError,
} from "@/lib/club";
import {
  teamVisibleWhere,
  getTeamAccessLevel,
  assertTeamStatsWrite,
  assertTeamOwnership,
} from "@/lib/access";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

const run = Date.now().toString(36);
const email = (who: string) => `${who}-${run}@clubflow-test.local`;

async function mkUser(who: string, plan: "FREE" | "CLUB") {
  return prisma.user.create({
    data: {
      email: email(who),
      name: `Test ${who}`,
      passwordHash: "not-a-real-hash",
      plan,
    },
  });
}

async function main() {
  const owner = await mkUser("owner", "CLUB");
  const coach2 = await mkUser("coach2", "FREE");
  const assistant = await mkUser("assistant", "FREE");
  const outsider = await mkUser("outsider", "FREE");
  const cleanupUserIds = [owner.id, coach2.id, assistant.id, outsider.id];
  let clubId: string | null = null;

  try {
    // 1. Club auto-creation for a CLUB-plan subscriber
    const membership = await ensureClubForOwner(owner.id);
    check("club auto-created for CLUB subscriber", Boolean(membership));
    check("subscriber is OWNER", membership?.role === "OWNER");
    clubId = membership!.club.id;

    // 2. Invite -> accept (existing account path)
    const inv = await createInvite(owner.id, email("coach2"));
    check("invite created with code", inv.code.length >= 8);
    const joined = await acceptInvite(inv.code, coach2.id);
    check("coach2 joined the club", joined.clubId === clubId && !joined.already);
    const m2 = await getClubMembership(coach2.id);
    check("coach2 role is COACH", m2?.role === "COACH");

    // Invite reuse is rejected
    let reuseRejected = false;
    try {
      await acceptInvite(inv.code, assistant.id);
    } catch (e) {
      reuseRejected = e instanceof ClubError && e.status === 409;
    }
    check("used invite can't be reused", reuseRejected);

    // Expired invite is rejected
    const inv2 = await createInvite(owner.id, email("assistant"));
    await prisma.clubInvite.update({
      where: { code: inv2.code },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    let expiredRejected = false;
    try {
      await acceptInvite(inv2.code, assistant.id);
    } catch (e) {
      expiredRejected = e instanceof ClubError && e.status === 410;
    }
    check("expired invite rejected", expiredRejected);

    // Assistant joins via a fresh invite, then gets the ASSISTANT role
    const inv3 = await createInvite(owner.id, email("assistant"));
    await acceptInvite(inv3.code, assistant.id);
    await prisma.clubMember.updateMany({
      where: { userId: assistant.id, clubId },
      data: { role: "ASSISTANT" },
    });

    // 3. Teams: owner + coach2 each create a club-shared team
    const ownerTeam = await prisma.team.create({
      data: { name: `OwnerTeam-${run}`, coachId: owner.id, clubId },
    });
    const coach2Team = await prisma.team.create({
      data: { name: `Coach2Team-${run}`, coachId: coach2.id, clubId },
    });

    // Visibility: PRIVATE teams with owner oversight
    const coach2Sees = await prisma.team.findMany({
      where: teamVisibleWhere(coach2.id),
      select: { id: true },
    });
    const ids = coach2Sees.map((t) => t.id);
    check(
      "club COACH sees ONLY their own team (private)",
      ids.includes(coach2Team.id) && !ids.includes(ownerTeam.id),
    );
    const ownerSees = await prisma.team.findMany({
      where: teamVisibleWhere(owner.id),
      select: { id: true },
    });
    check(
      "OWNER sees coach2's team (oversight)",
      ownerSees.some((t) => t.id === coach2Team.id),
    );
    const assistantSees = await prisma.team.findMany({
      where: teamVisibleWhere(assistant.id),
      select: { id: true },
    });
    check("ASSISTANT sees no teams (none assigned)", assistantSees.length === 0);
    const outsiderSees = await prisma.team.findMany({
      where: teamVisibleWhere(outsider.id),
      select: { id: true },
    });
    check("outsider sees no club teams", outsiderSees.length === 0);

    // 4. Role permissions
    check(
      "creating coach has manage access",
      (await getTeamAccessLevel(coach2Team.id, coach2.id)) === "manage",
    );
    check(
      "OWNER has read-only oversight on others' teams",
      (await getTeamAccessLevel(coach2Team.id, owner.id)) === "read",
    );
    check(
      "OWNER may NOT write stats on others' teams",
      !(await assertTeamStatsWrite(coach2Team.id, owner.id)),
    );
    check(
      "club COACH has NO access to others' teams",
      (await getTeamAccessLevel(ownerTeam.id, coach2.id)) === null,
    );
    check(
      "ASSISTANT has NO access to unassigned teams",
      (await getTeamAccessLevel(ownerTeam.id, assistant.id)) === null,
    );
    check(
      "ASSISTANT may NOT write stats on unassigned teams",
      !(await assertTeamStatsWrite(ownerTeam.id, assistant.id)),
    );
    check(
      "club COACH may NOT manage others' teams",
      !(await assertTeamOwnership(ownerTeam.id, coach2.id)),
    );
    check(
      "outsider has no access at all",
      (await getTeamAccessLevel(ownerTeam.id, outsider.id)) === null,
    );

    // 5. Effective plan inheritance
    check(
      "FREE coach2 inherits CLUB features via club",
      (await getEffectivePlan(coach2.id)) === "CLUB",
    );
    check(
      "outsider stays FREE",
      (await getEffectivePlan(outsider.id)) === "FREE",
    );

    // 6. maxCoaches cap: fill to 15 members, then invites must fail
    const fillerIds: string[] = [];
    const current = await prisma.clubMember.count({ where: { clubId } });
    for (let i = current; i < 15; i++) {
      const filler = await prisma.user.create({
        data: {
          email: email(`filler${i}`),
          name: `Filler ${i}`,
          passwordHash: "x",
        },
      });
      fillerIds.push(filler.id);
      await prisma.clubMember.create({
        data: { userId: filler.id, clubId, role: "COACH" },
      });
    }
    cleanupUserIds.push(...fillerIds);
    let capEnforced = false;
    try {
      await createInvite(owner.id, email("overflow"));
    } catch (e) {
      capEnforced = e instanceof ClubError && e.status === 409;
    }
    check("16th coach invite rejected (15-coach cap)", capEnforced);

    // 7. Only OWNER can invite
    let nonOwnerBlocked = false;
    try {
      await createInvite(coach2.id, email("nope"));
    } catch (e) {
      nonOwnerBlocked = e instanceof ClubError && e.status === 403;
    }
    check("non-owner can't create invites", nonOwnerBlocked);
  } finally {
    // Cleanup: delete users (cascades memberships + their teams), then club
    // (cascades invites).
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    if (clubId) await prisma.club.delete({ where: { id: clubId } }).catch(() => {});
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
