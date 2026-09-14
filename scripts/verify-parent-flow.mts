// End-to-end Parent Live View verification against the real DB and the real
// lib code (parent.ts + parent-view.ts). Creates throwaway users/teams with
// @parentflow-test.local emails and deletes everything in a finally block.
// Run:  node --import tsx scripts/verify-parent-flow.mts

import { prisma } from "@/lib/prisma";
import {
  ParentError,
  getParentPlayers,
  getPlayerForParent,
  getTeamParentLinks,
  issueParentCode,
  linkParentByCode,
  normalizeParentCode,
  revokeParentAccess,
  teamPrefix,
  unlinkParent,
} from "@/lib/parent";
import { buildLiveSnapshot, buildParentPlayerView, matchStatus } from "@/lib/parent-view";

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
  const cleanupUserIds = [coach.id, parent.id];

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
    const code = await issueParentCode(maya.id);
    check("issued code has the HAWK-7K2 shape", /^[A-Z]{4}-[A-HJ-NP-Z2-9]{3}$/.test(code));
    check("issued code carries the team prefix", code.startsWith("THUN-"));
    const stored = await prisma.player.findUnique({ where: { id: maya.id } });
    check("code stored on the player", stored?.parentCode === code && !!stored.parentCodeCreatedAt);

    // 2. Linking
    const first = await linkParentByCode(parent.id, code.toLowerCase());
    check("parent links with a lowercase code", first.player.id === maya.id);
    const again = await linkParentByCode(parent.id, code);
    check("linking twice is idempotent", again.link.id === first.link.id);
    let badRejected = false;
    try {
      await linkParentByCode(parent.id, "NOPE-000");
    } catch (e) {
      badRejected = e instanceof ParentError && e.status === 404;
    }
    check("unknown code rejected with 404", badRejected);

    const samCode = await issueParentCode(sam.id);
    const samLink = await linkParentByCode(parent.id, samCode);
    const mine = await getParentPlayers(parent.id);
    check("one parent follows siblings on two teams", mine.length === 2 && mine.some((p) => p.team.id === teamB.id));
    check("no-positions flag travels with the team", mine.find((p) => p.player.id === sam.id)?.team.usesPositions === false);

    // 3. Gate
    check("linked player is viewable", (await getPlayerForParent(parent.id, maya.id))?.id === maya.id);
    check("unlinked teammate is NOT viewable", (await getPlayerForParent(parent.id, zara.id)) === null);
    const coachLinks = await getTeamParentLinks(teamA.id);
    check("coach sees the linked parent on the team", coachLinks.length === 1 && coachLinks[0].parent.email === parent.email);

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
    await prisma.match.update({ where: { id: match.id }, data: { result: "WIN", setsWon: 3, setsLost: 1 } });
    snap = await buildLiveSnapshot(maya.id);
    check("snapshot after End match = final", snap.status === "final" && snap.match?.setsWon === 3);

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
    check("revoke unlinks parents and clears the code", removed === 1 && afterRevoke?.parentCode === null);
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
