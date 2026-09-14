// End-to-end Parent Live View verification against the real DB and the real
// lib code (parent.ts + parent-view.ts). Creates throwaway users/teams with
// @parentflow-test.local emails and deletes everything in a finally block.
// Run:  node --import tsx scripts/verify-parent-flow.mts

import { prisma } from "@/lib/prisma";
import {
  PARENT_CODE_MAX_REDEMPTIONS,
  PARENT_CODE_TTL_DAYS,
  ParentError,
  getParentPlayers,
  getPlayerForParent,
  getTeamParentLinks,
  getUnseenParentLinks,
  issueParentCode,
  linkParentByCode,
  markParentLinkSeen,
  normalizeParentCode,
  parentCodeStatus,
  revokeParentAccess,
  revokeParentLink,
  teamPrefix,
  unlinkParent,
} from "@/lib/parent";
import { buildLiveSnapshot, buildParentPlayerView, matchStatus } from "@/lib/parent-view";
import { teamHistoricalRallyRate } from "@/lib/win-probability-data";

async function expectParentError(fn: () => Promise<unknown>, status: number): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof ParentError && e.status === status;
  }
}

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
const email = (who: string) => `${who}-${run}@parentflow-test.local`;

async function main() {
  const coach = await prisma.user.create({
    data: { email: email("coach"), name: "Test Coach", passwordHash: "x", role: "COACH", plan: "FREE" },
  });
  const parent = await prisma.user.create({
    data: { email: email("parent"), name: "Test Parent", passwordHash: "x", role: "PARENT" },
  });
  // Extra family members for the redemption cap.
  const aunt = await prisma.user.create({
    data: { email: email("aunt"), name: "Test Aunt", passwordHash: "x", role: "PARENT" },
  });
  const uncle = await prisma.user.create({
    data: { email: email("uncle"), name: "Test Uncle", passwordHash: "x", role: "PARENT" },
  });
  const cousin = await prisma.user.create({
    data: { email: email("cousin"), name: "Test Cousin", passwordHash: "x", role: "PARENT" },
  });
  const cleanupUserIds = [coach.id, parent.id, aunt.id, uncle.id, cousin.id];

  try {
    // Teams: A with positions, B without (sibling on another team).
    const teamA = await prisma.team.create({
      data: { name: "Thunder Hawks 16U", ageGroup: "16U", coachId: coach.id, usesPositions: true },
    });
    const teamB = await prisma.team.create({
      data: { name: "Thunder Hawks 13U", ageGroup: "13U", coachId: coach.id, usesPositions: false },
    });
    const maya = await prisma.player.create({
      data: { teamId: teamA.id, name: "Maya", number: 7, primaryPosition: "L" },
    });
    const zara = await prisma.player.create({
      data: { teamId: teamA.id, name: "Zara", number: 12, primaryPosition: "OH" },
    });
    const sam = await prisma.player.create({
      data: { teamId: teamB.id, name: "Sam", number: 2, primaryPosition: "UTIL" },
    });

    // 1. Codes
    check("team prefix uses first four letters", teamPrefix("Thunder Hawks 16U") === "THUN");
    check("team prefix pads short names", teamPrefix("A-B") === "ABXX");
    check("code normalizer accepts spaces/lowercase", normalizeParentCode("hawk 7k2") === "HAWK-7K2");
    check("code normalizer accepts no dash", normalizeParentCode("hawk7k2") === "HAWK-7K2");
    const issued = await issueParentCode(maya.id);
    const code = issued.code;
    check("issued code has the HAWK-7K2 shape", /^[A-Z]{4}-[A-HJ-NP-Z2-9]{3}$/.test(code));
    check("issued code carries the team prefix", code.startsWith("THUN-"));
    const stored = await prisma.player.findUnique({ where: { id: maya.id } });
    check("code stored on the player", stored?.parentCode === code && !!stored.parentCodeCreatedAt);
    const ttlDays = (issued.expiresAt.getTime() - Date.now()) / 86400000;
    check(`issued code expires in ${PARENT_CODE_TTL_DAYS} days`, ttlDays > PARENT_CODE_TTL_DAYS - 0.01 && ttlDays <= PARENT_CODE_TTL_DAYS);
    check("issued code starts with 0 redemptions", issued.redemptions === 0 && stored?.parentCodeRedemptions === 0);
    check("status helper: fresh code is active", parentCodeStatus(stored!).state === "active");
    check("status helper: no code = none", parentCodeStatus({ parentCode: null, parentCodeRedemptions: 0, parentCodeExpiresAt: null }).state === "none");

    // 2. Linking
    const first = await linkParentByCode(parent.id, code.toLowerCase());
    check("parent links with a lowercase code", first.player.id === maya.id && first.alreadyLinked === false);
    const again = await linkParentByCode(parent.id, code);
    check("linking twice is idempotent", again.link.id === first.link.id && again.alreadyLinked === true);
    const afterRelink = await prisma.player.findUnique({ where: { id: maya.id } });
    check("re-linking the same parent does not use a redemption", afterRelink?.parentCodeRedemptions === 1);
    let badRejected = false;
    try {
      await linkParentByCode(parent.id, "NOPE-000");
    } catch (e) {
      badRejected = e instanceof ParentError && e.status === 404;
    }
    check("unknown code rejected with 404", badRejected);

    // 2b. Redemption cap: 3 family members, the 4th is turned away.
    await linkParentByCode(aunt.id, code);
    await linkParentByCode(uncle.id, code);
    const capped = await prisma.player.findUnique({ where: { id: maya.id } });
    check(`three redemptions use the code up (${PARENT_CODE_MAX_REDEMPTIONS}/${PARENT_CODE_MAX_REDEMPTIONS})`, capped?.parentCodeRedemptions === 3 && parentCodeStatus(capped).state === "exhausted");
    check("4th family member is rejected with 409", await expectParentError(() => linkParentByCode(cousin.id, code), 409));
    check("already-linked parent can still re-enter an exhausted code", (await linkParentByCode(aunt.id, code)).alreadyLinked === true);
    check("all three stay linked", (await prisma.parentPlayerLink.count({ where: { playerId: maya.id } })) === 3);

    // 2c. Regenerating resets the counter and kills the old code.
    const reissued = await issueParentCode(maya.id);
    check("regenerated code is different", reissued.code !== code && reissued.redemptions === 0);
    check("old code no longer resolves", await expectParentError(() => linkParentByCode(cousin.id, code), 404));
    const reissuedRow = await prisma.player.findUnique({ where: { id: maya.id } });
    check("regenerate resets redemptions to 0", reissuedRow?.parentCodeRedemptions === 0 && parentCodeStatus(reissuedRow).state === "active");
    check("existing parents keep access after regenerate", (await prisma.parentPlayerLink.count({ where: { playerId: maya.id } })) === 3);

    // 2d. Expiry: 30 days unused and the code is dead for new parents.
    await prisma.player.update({ where: { id: maya.id }, data: { parentCodeExpiresAt: new Date(Date.now() - 1000) } });
    const expiredRow = await prisma.player.findUnique({ where: { id: maya.id } });
    check("status helper: past expiry = expired", parentCodeStatus(expiredRow!).state === "expired");
    check("expired code is rejected with 410", await expectParentError(() => linkParentByCode(cousin.id, reissued.code), 410));
    check("already-linked parent can still re-enter an expired code", (await linkParentByCode(parent.id, reissued.code)).alreadyLinked === true);
    const fresh2 = await issueParentCode(maya.id);
    check("regenerating after expiry gives a live code again", parentCodeStatus((await prisma.player.findUnique({ where: { id: maya.id } }))!).state === "active");
    const cousinLink = await linkParentByCode(cousin.id, fresh2.code);
    check("4th family member links with the new code", cousinLink.alreadyLinked === false && (await prisma.parentPlayerLink.count({ where: { playerId: maya.id } })) === 4);

    // 2e. Coach notices + individual revoke.
    const unseen = await getUnseenParentLinks(teamA.id);
    check("coach sees every new link as an unseen notice", unseen.length === 4 && unseen[0].player.name === "Maya" && unseen.every((l) => l.coachSeenAt === null));
    check("dismissing a notice marks it seen", (await markParentLinkSeen(teamA.id, cousinLink.link.id)) === true);
    check("dismissing twice is a no-op", (await markParentLinkSeen(teamA.id, cousinLink.link.id)) === false);
    check("dismissed notice disappears", (await getUnseenParentLinks(teamA.id)).length === 3);
    check("another team cannot dismiss this team's notice", (await markParentLinkSeen(teamB.id, first.link.id)) === false);
    check("coach cannot revoke a link through the wrong team", (await revokeParentLink(teamB.id, cousinLink.link.id)) === false);
    check("coach revokes one parent's link", (await revokeParentLink(teamA.id, cousinLink.link.id)) === true);
    check("revoked cousin can no longer view Maya", (await getPlayerForParent(cousin.id, maya.id)) === null);
    check("the other parents keep access", (await getPlayerForParent(aunt.id, maya.id))?.id === maya.id && (await prisma.parentPlayerLink.count({ where: { playerId: maya.id } })) === 3);
    check("revoking a link leaves the code and its count alone", (await prisma.player.findUnique({ where: { id: maya.id } }))?.parentCodeRedemptions === 1);

    const samCode = (await issueParentCode(sam.id)).code;
    const samLink = await linkParentByCode(parent.id, samCode);
    const mine = await getParentPlayers(parent.id);
    check("one parent follows siblings on two teams", mine.length === 2 && mine.some((p) => p.team.id === teamB.id));
    check("no-positions flag travels with the team", mine.find((p) => p.player.id === sam.id)?.team.usesPositions === false);

    // 3. Gate
    check("linked player is viewable", (await getPlayerForParent(parent.id, maya.id))?.id === maya.id);
    check("unlinked teammate is NOT viewable", (await getPlayerForParent(parent.id, zara.id)) === null);
    const coachLinks = await getTeamParentLinks(teamA.id);
    check("coach sees the linked parents on the team", coachLinks.length === 3 && coachLinks.some((l) => l.parent.email === parent.email));

    // 4. Live status
    const now = Date.now();
    const fresh = { result: null, createdAt: new Date(now) };
    check("match with stats + no result = live", matchStatus(fresh, true, now) === "live");
    check("match with no stats = pending", matchStatus(fresh, false, now) === "pending");
    check("match with result = final", matchStatus({ result: "WIN", createdAt: new Date(now) }, true, now) === "final");
    check("stale unfinished match is not live", matchStatus({ result: null, createdAt: new Date(now - 2 * 86400000) }, true, now) === "pending");

    const tournament = await prisma.tournament.create({
      data: { teamId: teamA.id, name: "Winter Invitational", startDate: new Date() },
    });
    const match = await prisma.match.create({
      data: { tournamentId: tournament.id, opponent: "Metro Tigers", matchNumber: 1 },
    });
    let snap = await buildLiveSnapshot(maya.id);
    check("snapshot before lineup = pending", snap.status === "pending" && snap.match?.opponent === "Metro Tigers");
    await prisma.statLine.create({
      data: { matchId: match.id, playerId: maya.id, positionPlayed: "L", kills: 0, aces: 1, digs: 6, sr2: 3, sr3: 1, serveErrors: 1 },
    });
    await prisma.statLine.create({
      data: { matchId: match.id, playerId: zara.id, positionPlayed: "OH", kills: 7 },
    });
    snap = await buildLiveSnapshot(maya.id);
    check("snapshot during play = live with the child's numbers", snap.status === "live" && snap.stats?.digs === 6 && snap.stats?.aces === 1);
    check("live snapshot carries a Bank Account", snap.bankAccount !== null && snap.bankAccount!.balance === 4);
    check("no set scores yet = no current set", snap.sets.length === 0 && snap.currentSet === null);
    check("no finished matches = no historical rally rate", (await teamHistoricalRallyRate(teamA.id)) === null);

    // 4b. Live set score + win probability (what the courtside page PUTs).
    await prisma.matchSetScore.create({
      data: { matchId: match.id, setNumber: 1, us: 1, them: 1, history: [[0, 0], [1, 0], [1, 1]] },
    });
    snap = await buildLiveSnapshot(maya.id);
    check("current set score reaches the parent", snap.currentSet?.setNumber === 1 && snap.currentSet?.us === 1 && snap.currentSet?.them === 1);
    check("win chance hidden under 3 rallies", snap.currentSet?.winChancePct === null && snap.currentSet?.rallies === 2);
    await prisma.matchSetScore.update({
      where: { matchId_setNumber: { matchId: match.id, setNumber: 1 } },
      data: { us: 20, them: 12, history: Array.from({ length: 33 }, (_, i) => [Math.min(20, Math.ceil(i * 20 / 32)), Math.min(12, Math.floor(i * 12 / 32))]) },
    });
    snap = await buildLiveSnapshot(maya.id);
    check("leading 20-12 = high set win chance", (snap.currentSet?.winChancePct ?? 0) > 85);
    check("sparkline history has one point per rally", (snap.currentSet?.winChanceHistory.length ?? 0) > 20);
    await prisma.matchSetScore.create({
      data: { matchId: match.id, setNumber: 2, us: 25, them: 27, history: [] },
    });
    await prisma.matchSetScore.update({
      where: { matchId_setNumber: { matchId: match.id, setNumber: 1 } },
      data: { us: 25, them: 15 },
    });
    snap = await buildLiveSnapshot(maya.id);
    check("finished sets are marked decided", snap.sets.length === 2 && snap.sets[0].decided === "us" && snap.sets[1].decided === "them");
    check("a decided current set reports 0%/100%", snap.currentSet?.setNumber === 2 && snap.currentSet?.winChancePct === 0);
    let badHistory = false;
    try {
      await prisma.matchSetScore.update({
        where: { matchId_setNumber: { matchId: match.id, setNumber: 2 } },
        data: { history: [[1, "x"], [99, 99], "junk", [2, 2]] },
      });
      snap = await buildLiveSnapshot(maya.id);
      badHistory = snap.currentSet !== null; // garbage rows ignored, no crash
    } catch {
      badHistory = false;
    }
    check("malformed score history is ignored, not fatal", badHistory);

    await prisma.match.update({ where: { id: match.id }, data: { result: "WIN", setsWon: 3, setsLost: 1 } });
    snap = await buildLiveSnapshot(maya.id);
    check("snapshot after End match = final", snap.status === "final" && snap.match?.setsWon === 3);
    const hist = await teamHistoricalRallyRate(teamA.id);
    check("finished match feeds the historical rally rate", hist !== null && hist > 0.5 && hist < 0.6);
    check("excluding the live match removes its history", (await teamHistoricalRallyRate(teamA.id, match.id)) === null);

    // 5. Full view never leaks teammates
    const view = await buildParentPlayerView(maya.id);
    check("view built for the child", view?.player.name === "Maya" && view.hasStats);
    const dump = JSON.stringify(view);
    check("view never mentions a teammate", !dump.includes("Zara"));
    check("view compares to team averages only", (view?.comparison.length ?? 0) === 5);
    check("report card has an empty cohort (no comparison card)", view?.reportCard?.cohort.length === 0);
    check("parent-friendly summary present", typeof view?.parentFriendly === "string" && view.parentFriendly.includes("Maya"));

    // 6. Coach controls end access
    await prisma.team.update({ where: { id: teamA.id }, data: { allowParentView: false } });
    check("team toggle off hides the player", (await getPlayerForParent(parent.id, maya.id)) === null);
    await prisma.team.update({ where: { id: teamA.id }, data: { allowParentView: true } });
    await prisma.player.update({ where: { id: maya.id }, data: { isActive: false } });
    check("removing the player from the roster hides them", (await getPlayerForParent(parent.id, maya.id)) === null);
    await prisma.player.update({ where: { id: maya.id }, data: { isActive: true } });
    const removed = await revokeParentAccess(maya.id);
    const afterRevoke = await prisma.player.findUnique({ where: { id: maya.id } });
    check("revoke unlinks parents and clears the code", removed === 3 && afterRevoke?.parentCode === null && afterRevoke.parentCodeExpiresAt === null && afterRevoke.parentCodeRedemptions === 0);
    check("revoked player is no longer viewable", (await getPlayerForParent(parent.id, maya.id)) === null);

    // 7. Parent self-service unlink
    check("parent can unlink a player", (await unlinkParent(parent.id, samLink.link.id)) === true);
    check("someone else's link id is rejected", (await unlinkParent(coach.id, samLink.link.id)) === false);
    check("nothing followed after unlink", (await getParentPlayers(parent.id)).length === 0);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
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
