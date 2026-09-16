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
import {
  buildLiveSnapshot,
  buildParentPlayerView,
  getTeamLive,
  matchStatus,
  type PlayerCourtState,
} from "@/lib/parent-view";
import { baselineFromLines, mergeCourtState } from "@/lib/court-state";
import {
  BACK_ON_COURT_CHIP,
  FORBIDDEN_PRONOUNS,
  FORBIDDEN_WORDS,
  playerStateCopy,
} from "@/lib/player-state-copy";
import { teamHistoricalRallyRate } from "@/lib/win-probability-data";
import { invalidateLive, liveCacheStats, resetLiveCache } from "@/lib/live-cache";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { weakEtag } from "@/lib/etag";

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
    // The test writes straight to the database, so it invalidates the live
    // cache the way the courtside routes do before each fresh read.
    const liveNow = async () => {
      invalidateLive({ teamId: teamA.id, matchId: match.id });
      return buildLiveSnapshot(maya.id);
    };
    let snap = await liveNow();
    check("snapshot before lineup = pending", snap.status === "pending" && snap.match?.opponent === "Metro Tigers");
    await prisma.statLine.create({
      data: { matchId: match.id, playerId: maya.id, positionPlayed: "L", kills: 0, aces: 1, digs: 6, sr2: 3, sr3: 1, serveErrors: 1 },
    });
    await prisma.statLine.create({
      data: { matchId: match.id, playerId: zara.id, positionPlayed: "OH", kills: 7 },
    });
    snap = await liveNow();
    check("snapshot during play = live with the child's numbers", snap.status === "live" && snap.stats?.digs === 6 && snap.stats?.aces === 1);
    check("live snapshot carries a Bank Account", snap.bankAccount !== null && snap.bankAccount!.balance === 4);
    check("no set scores yet = no current set", snap.sets.length === 0 && snap.currentSet === null);
    check("no finished matches = no historical rally rate", (await teamHistoricalRallyRate(teamA.id)) === null);

    // 4b. Live set score + win probability (what the courtside page PUTs).
    await prisma.matchSetScore.create({
      data: { matchId: match.id, setNumber: 1, us: 1, them: 1, history: [[0, 0], [1, 0], [1, 1]] },
    });
    snap = await liveNow();
    check("current set score reaches the parent", snap.currentSet?.setNumber === 1 && snap.currentSet?.us === 1 && snap.currentSet?.them === 1);
    check("win chance hidden under 3 rallies", snap.currentSet?.winChancePct === null && snap.currentSet?.rallies === 2);
    await prisma.matchSetScore.update({
      where: { matchId_setNumber: { matchId: match.id, setNumber: 1 } },
      data: { us: 20, them: 12, history: Array.from({ length: 33 }, (_, i) => [Math.min(20, Math.ceil(i * 20 / 32)), Math.min(12, Math.floor(i * 12 / 32))]) },
    });
    snap = await liveNow();
    check("leading 20-12 = high set win chance", (snap.currentSet?.winChancePct ?? 0) > 85);
    check("sparkline history has one point per rally", (snap.currentSet?.winChanceHistory.length ?? 0) > 20);
    await prisma.matchSetScore.create({
      data: { matchId: match.id, setNumber: 2, us: 25, them: 27, history: [] },
    });
    await prisma.matchSetScore.update({
      where: { matchId_setNumber: { matchId: match.id, setNumber: 1 } },
      data: { us: 25, them: 15 },
    });
    snap = await liveNow();
    check("finished sets are marked decided", snap.sets.length === 2 && snap.sets[0].decided === "us" && snap.sets[1].decided === "them");
    check("a decided current set reports 0%/100%", snap.currentSet?.setNumber === 2 && snap.currentSet?.winChancePct === 0);
    let badHistory = false;
    try {
      await prisma.matchSetScore.update({
        where: { matchId_setNumber: { matchId: match.id, setNumber: 2 } },
        data: { history: [[1, "x"], [99, 99], "junk", [2, 2]] },
      });
      snap = await liveNow();
      badHistory = snap.currentSet !== null; // garbage rows ignored, no crash
    } catch {
      badHistory = false;
    }
    check("malformed score history is ignored, not fatal", badHistory);

    await prisma.match.update({ where: { id: match.id }, data: { result: "WIN", setsWon: 3, setsLost: 1 } });
    snap = await liveNow();
    check("snapshot after End match = final", snap.status === "final" && snap.match?.setsWon === 3);
    const hist = await teamHistoricalRallyRate(teamA.id);
    check("finished match feeds the historical rally rate", hist !== null && hist > 0.5 && hist < 0.6);
    check("excluding the live match removes its history", (await teamHistoricalRallyRate(teamA.id, match.id)) === null);

    // 4c. Live cache: shared reads, invalidation, coalescing, ETag, rate limit
    resetLiveCache();
    const a = await liveNow();
    const fillsAfterFirst = liveCacheStats().fills;
    const b = await buildLiveSnapshot(maya.id);
    check("second read within the TTL is served from cache", liveCacheStats().fills === fillsAfterFirst && b.etag === a.etag);
    await prisma.matchSetScore.update({
      where: { matchId_setNumber: { matchId: match.id, setNumber: 2 } },
      data: { us: 26, them: 27 },
    });
    const c = await buildLiveSnapshot(maya.id);
    check("a write without invalidation is not seen until the TTL (by design)", c.currentSet?.us === b.currentSet?.us);
    invalidateLive({ matchId: match.id });
    const d = await buildLiveSnapshot(maya.id);
    check("invalidating the match makes the next read fresh", d.currentSet?.us === 26 && d.etag !== c.etag);
    check("lastUpdated follows the set-score write", d.lastUpdated !== null && d.lastUpdated! > (c.lastUpdated ?? ""));
    resetLiveCache();
    const fillsBefore = liveCacheStats().fills;
    await Promise.all(Array.from({ length: 50 }, () => buildLiveSnapshot(maya.id)));
    check("50 concurrent reads coalesce into one load per key", liveCacheStats().fills - fillsBefore === 2);
    const teamLive = await getTeamLive(teamA.id);
    check("team context carries the gate data for the poll", teamLive?.allowParentView === true && teamLive.players[maya.id]?.parentIds.includes(parent.id) === true && teamLive.players[zara.id]?.parentIds.length === 0);
    check("etag is content-based", weakEtag({ a: 1 }) === weakEtag({ a: 1 }) && weakEtag({ a: 1 }) !== weakEtag({ a: 2 }));
    resetRateLimits();
    const t0 = 1_000_000;
    let passed8 = 0;
    for (let i = 0; i < 8; i += 1) if (rateLimit("p1", { max: 8, windowMs: 60_000, now: t0 + i * 1000 }).ok) passed8 += 1;
    const ninth = rateLimit("p1", { max: 8, windowMs: 60_000, now: t0 + 8_000 });
    check("8 polls a minute pass, the 9th is refused with Retry-After", passed8 === 8 && !ninth.ok && ninth.retryAfterSec >= 52);
    check("another parent is not affected", rateLimit("p2", { max: 8, windowMs: 60_000, now: t0 + 8_000 }).ok);
    check("the window slides", rateLimit("p1", { max: 8, windowMs: 60_000, now: t0 + 61_000 }).ok);

    // 4d. The live scoreboard and the four player states
    //
    // A second match, in progress, so the state machine can be driven all the
    // way through: on court, off the court, back on.
    const ivy = await prisma.player.create({
      data: { teamId: teamA.id, name: "Ivy", number: 3, primaryPosition: "MB" },
    });
    const nia = await prisma.player.create({
      data: { teamId: teamA.id, name: "Nia", number: 9, primaryPosition: "S" },
    });
    const live2 = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        opponent: "Central Thunder",
        matchNumber: 2,
        startedAt: new Date(),
      },
    });
    const board = async (playerId: string) => {
      invalidateLive({ teamId: teamA.id, matchId: live2.id });
      return buildLiveSnapshot(playerId);
    };
    await prisma.matchSetScore.create({
      data: { matchId: live2.id, setNumber: 1, us: 25, them: 22, history: [] },
    });
    await prisma.matchSetScore.create({
      data: { matchId: live2.id, setNumber: 2, us: 18, them: 14, history: [] },
    });
    await prisma.statLine.create({
      data: { matchId: live2.id, playerId: maya.id, positionPlayed: "L", digs: 4, sr3: 2 },
    });
    await prisma.statLine.create({
      data: { matchId: live2.id, playerId: ivy.id, positionPlayed: "MB", kills: 3 },
    });

    let s2 = await board(maya.id);
    check("scoreboard carries both team names", s2.match?.teamName === "Thunder Hawks 16U" && s2.match?.opponent === "Central Thunder");
    check("scoreboard shows the set in progress", s2.currentSet?.setNumber === 2 && s2.currentSet?.us === 18 && s2.currentSet?.them === 14);
    check("scoreboard keeps the finished set for its chip", s2.sets.length === 2 && s2.sets[0].us === 25 && s2.sets[0].decided === "us");
    check("running set tally counts decided sets only", s2.setsTally.us === 1 && s2.setsTally.them === 0);
    check("no lineup synced = state unknown, stats still shown", s2.playerState === "unknown" && s2.stats?.digs === 4);

    // The courtside screen syncs set 2's lineup. Maya and Zara start; Ivy is on
    // the match roster but has not been on this set; Nia is not in the match.
    await prisma.matchCourtState.create({
      data: {
        matchId: live2.id,
        setNumber: 2,
        onCourt: [maya.id, zara.id],
        appeared: [maya.id, zara.id],
        roster: [maya.id, zara.id, ivy.id],
        baseline: baselineFromLines([
          { playerId: maya.id, digs: 4, sr3: 2 },
          { playerId: ivy.id, kills: 3 },
        ]),
      },
    });
    s2 = await board(maya.id);
    const etagOnCourt = s2.etag;
    check("STATE 1: on court", s2.playerState === "on_court");
    check("on court: this set starts from the snapshot, not from zero totals", s2.setStats?.digs === 0 && s2.stats?.digs === 4);

    check("STATE 2: on the bench this set", (await board(ivy.id)).playerState === "bench");
    const benchSnap = await board(ivy.id);
    check("on the bench: earlier stats in the match stay on screen", benchSnap.stats?.kills === 3 && benchSnap.setStats?.kills === 0);
    check("STATE 4: not in this match", (await board(nia.id)).playerState === "not_in_match");
    check("not in the match: the scoreboard is still there", (await board(nia.id)).currentSet?.us === 18);

    // The coach records more of Maya's set.
    await prisma.statLine.update({
      where: { matchId_playerId: { matchId: live2.id, playerId: maya.id } },
      data: { digs: 7, kills: 2 },
    });
    s2 = await board(maya.id);
    check("on court: this-set figures are match totals minus the snapshot", s2.setStats?.digs === 3 && s2.setStats?.kills === 2 && s2.stats?.digs === 7);
    const bankBefore = s2.bankAccount?.balance ?? null;

    // Maya comes off for Ivy.
    const subbed = mergeCourtState(
      { onCourt: [maya.id, zara.id], appeared: [maya.id, zara.id], roster: [maya.id, zara.id, ivy.id] },
      { onCourt: [zara.id, ivy.id] },
    );
    check("merge keeps everyone who has been on court this set", subbed.appeared.includes(maya.id) && subbed.appeared.includes(ivy.id));
    check("merge replaces who is on court right now", !subbed.onCourt.includes(maya.id) && subbed.onCourt.length === 2);
    await prisma.matchCourtState.update({
      where: { matchId_setNumber: { matchId: live2.id, setNumber: 2 } },
      data: subbed,
    });
    s2 = await board(maya.id);
    check("STATE 3: off the court right now", s2.playerState === "off_court");
    check("coming off never resets the match stats", s2.stats?.digs === 7 && s2.stats?.kills === 2);
    check("coming off never moves the Bank Account", s2.bankAccount?.balance === bankBefore);
    check("this-set stats survive the substitution", s2.setStats?.digs === 3 && s2.setStats?.kills === 2);
    check("a substitution changes the etag, so the next poll sees it", s2.etag !== etagOnCourt);
    check("the player who came on is now on court", (await board(ivy.id)).playerState === "on_court");

    // And back on.
    await prisma.matchCourtState.update({
      where: { matchId_setNumber: { matchId: live2.id, setNumber: 2 } },
      data: mergeCourtState(subbed, { onCourt: [maya.id, zara.id] }),
    });
    s2 = await board(maya.id);
    check("going back on returns to STATE 1", s2.playerState === "on_court");
    check("nothing recorded is lost across the round trip", s2.stats?.digs === 7 && s2.setStats?.digs === 3);

    // A new set resets what "this set" means, without touching match totals.
    await prisma.matchSetScore.create({
      data: { matchId: live2.id, setNumber: 3, us: 2, them: 0, history: [] },
    });
    await prisma.matchCourtState.create({
      data: {
        matchId: live2.id,
        setNumber: 3,
        onCourt: [zara.id],
        appeared: [zara.id],
        roster: [maya.id, zara.id, ivy.id],
        baseline: baselineFromLines([{ playerId: maya.id, digs: 7, kills: 2 }]),
      },
    });
    s2 = await board(maya.id);
    check("a new set puts a player who has not been on back on the bench", s2.playerState === "bench");
    check("a new set zeroes the per-set figure but not the match totals", s2.setStats?.digs === 0 && s2.stats?.digs === 7);

    // Final
    await prisma.match.update({
      where: { id: live2.id },
      data: { result: "WIN", setsWon: 2, setsLost: 1 },
    });
    s2 = await board(maya.id);
    check("final match carries the result for the scoreboard", s2.status === "final" && s2.match?.result === "WIN" && s2.match?.setsWon === 2 && s2.match?.setsLost === 1);

    // 4e. Tone. Playing time is the most charged subject in the app, so the
    // copy is checked rather than trusted.
    const allStates: PlayerCourtState[] = ["on_court", "off_court", "bench", "not_in_match", "unknown"];
    let judgement: string | null = null;
    let pronoun: string | null = null;
    for (const st of allStates) {
      const c = playerStateCopy(st, "Sofia");
      const text = [c.chip, c.message, c.matchStatsLabel, c.setStatsLabel].filter(Boolean).join(" ").toLowerCase();
      for (const w of FORBIDDEN_WORDS) {
        if (new RegExp(`\\b${w.replace(/'/g, "['\u2019]")}\\b`).test(text)) judgement = `${st}: ${w}`;
      }
      for (const pr of FORBIDDEN_PRONOUNS) {
        if (new RegExp(`\\b${pr}\\b`).test(text)) pronoun = `${st}: ${pr}`;
      }
    }
    check(`no judgement words in any player-state copy${judgement ? ` (${judgement})` : ""}`, judgement === null);
    check(`no assumed pronouns in any player-state copy${pronoun ? ` (${pronoun})` : ""}`, pronoun === null);
    check("bench copy states the fact and what happens next", playerStateCopy("bench", "Sofia").message === "Sofia is on the bench this set. Stats will update as soon as Sofia goes in.");
    check("off-court copy is present tense and neutral", playerStateCopy("off_court", "Sofia").message === "Sofia is off the court right now.");
    check("not-in-match copy is a plain statement", playerStateCopy("not_in_match", "Sofia").message === "Sofia is not in this match.");
    check("off-court per-set line is labelled as this set", playerStateCopy("off_court", "Sofia").setStatsLabel === "Sofia's stats this set so far");
    check("the stat grid is always labelled as match totals", playerStateCopy("off_court", "Sofia").matchStatsLabel === "This match so far" && playerStateCopy("on_court", "Sofia").matchStatsLabel === "This match so far");
    check("bench grid says the numbers came from earlier in the match", playerStateCopy("bench", "Sofia").matchStatsLabel === "Earlier in this match");
    check("on court needs no explanation, only a chip", playerStateCopy("on_court", "Sofia").message === null && playerStateCopy("on_court", "Sofia").chip === "On court");
    check("an unknown lineup says nothing at all", playerStateCopy("unknown", "Sofia").message === null && playerStateCopy("unknown", "Sofia").chip === null);
    check("returning to the court is announced neutrally", BACK_ON_COURT_CHIP === "Back on court");
    const everyString = allStates
      .map((st) => playerStateCopy(st, "Sofia"))
      .flatMap((c) => [c.chip, c.message, c.matchStatsLabel, c.setStatsLabel])
      .filter(Boolean)
      .join(" ");
    check("copy never names a teammate", !everyString.includes("Maya") && !everyString.includes("Zara") && !everyString.includes("Ivy"));
    check("copy never counts sets played", !/\\bsets? played\\b/i.test(everyString) && !/\\bminutes\\b/i.test(everyString));

    // 5. Full view never leaks teammates
    invalidateLive({ teamId: teamA.id, matchId: match.id });
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
