// No-Positions Mode verification: the universal Bank Account formula, mode
// plumbing through derived stats / report data / AI request builders, and a
// DB round trip. Run:  node --import tsx scripts/verify-no-positions.mts

import type { Player } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateAggregateBankAccount, calculateBankAccount } from "@/engine/bank-account";
import { computeDerivedStats } from "@/engine/derived-stats";
import { computeImprovementAreas } from "@/components/reports/utils/improvement-rules";
import { buildReportCardData, cohortFor } from "@/lib/report-data";
import { suggestUsesPositions } from "@/lib/positions";
import { buildPlayerInsightRequest, statsForUniversal } from "@/engine/ai/request-builders";
import { buildPlayerUserPrompt } from "@/engine/ai/prompts";
import { generateRuleBasedPlayerInsight } from "@/engine/ai/rule-based";

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

const line = {
  kills: 4,
  attackErrors: 2,
  aces: 1,
  serveErrors: 1,
  blocks: 1,
  blockErrors: 1,
  assists: 3,
  sr0: 1,
  sr1: 2,
  sr2: 3,
  sr3: 2,
  generalErrors: 1,
  digs: 5,
};

function fakePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Ava",
    number: 2,
    primaryPosition: "UTIL",
    secondaryPosition: null,
    teamId: "t1",
    isActive: true,
    createdAt: new Date(),
    parentCode: null,
    parentCodeCreatedAt: null,
    ...overrides,
  };
}

async function main() {
  // 1. Universal formula
  const uni = calculateBankAccount(line, "L", "universal");
  check("universal deposits = kills+aces+blocks+assists+digs+sr2+sr3 (19)", uni.deposits === 19);
  check("universal withdrawals = serve+attack+net+general errors+sr0 (6)", uni.withdrawals === 6);
  check("universal balance +13, GREEN", uni.balance === 13 && uni.rating === "GREEN");
  check("universal result has no position group", uni.positionGroup === null);
  check("universal breakdown includes digs", uni.depositBreakdown.digs === 5);

  // 2. Positions mode on the same line. Digs now count for every group, so a
  // libero's deposits include the 5 digs; attack and net errors are still
  // ignored for them, which is the part this is guarding.
  const lib = calculateBankAccount(line, "L");
  check("libero rules ignore attack/net errors (withdrawals 3)", lib.withdrawals === 3 && lib.deposits === 19, `${lib.withdrawals} / ${lib.deposits}`);

  // 3. Aggregate + derived stats carry the mode
  const agg = calculateAggregateBankAccount([{ ...line, positionPlayed: "UTIL" }, { ...line, positionPlayed: "UTIL" }], "UTIL", "universal");
  check("aggregate universal sums both lines (+26)", agg.balance === 26);
  const full = { ...line, attackAttempts: 10, serveAttempts: 8, settingErrors: 0, setsPlayed: 2, didNotPlay: false, positionPlayed: "UTIL" as const };
  const ds = computeDerivedStats([full], "UTIL", "universal");
  check("computeDerivedStats passes the mode through", ds.bankAccount.balance === 13 && ds.bankAccount.positionGroup === null);

  // 4. Universal improvement rules never give position-only advice
  const areas = computeImprovementAreas(ds, "UTIL", "Ava", { universal: true });
  const positionOnly = ["Distribution", "Quick attack efficiency", "Blocking presence", "Shot selection"];
  check("three all-around focus areas", areas.length === 3);
  check("no position-specific focus areas", areas.every((a) => !positionOnly.includes(a.metric)));

  // 5. Age-group defaults
  check("12U/13U/14U default to no positions", !suggestUsesPositions("12U") && !suggestUsesPositions("13U") && !suggestUsesPositions("14U"));
  check("15U and up default to positions", suggestUsesPositions("15U") && suggestUsesPositions("18U"));
  check("unknown age group defaults to positions", suggestUsesPositions("") && suggestUsesPositions(null));

  // 6. AI request / prompt / fallback
  const uniStats = statsForUniversal(ds);
  check("universal stats include digs, blocks and assists", "digsPerMatch" in uniStats && "blocksPerMatch" in uniStats && "assistsPerMatch" in uniStats);
  const req = buildPlayerInsightRequest({
    player: fakePlayer(),
    usesPositions: false,
    scope: "season",
    scopeId: null,
    scopeLabel: "Full Season",
    ageGroup: "13U",
    playerLines: [{ ...full, id: "s1", matchId: "m1", playerId: "p1" }],
  });
  check("request flags the no-positions team", req.usesPositions === false && "digsPerMatch" in req.stats);
  const prompt = buildPlayerUserPrompt(req);
  check("prompt tells the model there are no positions", prompt.includes("without set positions") && prompt.includes("all-around"));
  check("prompt uses the all-around drill list", prompt.includes("AVAILABLE DRILLS (recommend ONLY these"));
  const fallback = generateRuleBasedPlayerInsight(req);
  check("rule-based parent summary speaks to the all-around game", fallback.parentFriendly.includes("all-around"));
  check("rule-based coaching note is not position-specific", fallback.coachingNote.includes("every spot"));

  // 7. DB round trip: team with usesPositions=false, cohorts include everyone
  const run = Date.now().toString(36);
  const coach = await prisma.user.create({
    data: { email: `coach-${run}@nopositions-test.local`, name: "Test Coach", passwordHash: "x" },
  });
  try {
    const team = await prisma.team.create({
      data: { name: "Test 13U", ageGroup: "13U", coachId: coach.id, usesPositions: false },
    });
    const reread = await prisma.team.findUnique({ where: { id: team.id } });
    check("usesPositions persists on the team", reread?.usesPositions === false && reread.allowParentView === true);
    const players = await Promise.all(
      ["Ava", "Chloe", "Sofia"].map((name, i) =>
        prisma.player.create({ data: { teamId: team.id, name, number: i + 1, primaryPosition: "UTIL" } }),
      ),
    );
    const tournament = await prisma.tournament.create({
      data: { teamId: team.id, name: "Jamboree", startDate: new Date() },
    });
    const match = await prisma.match.create({
      data: { tournamentId: tournament.id, opponent: "Storm", matchNumber: 1, result: "WIN" },
    });
    await prisma.statLine.createMany({
      data: players.map((p) => ({ matchId: match.id, playerId: p.id, positionPlayed: "UTIL" as const, ...line, attackAttempts: 10, serveAttempts: 8, setsPlayed: 2 })),
    });
    const lines = await prisma.statLine.findMany({ where: { matchId: match.id } });
    const byPlayer = new Map<string, typeof lines>();
    for (const l of lines) byPlayer.set(l.playerId, [...(byPlayer.get(l.playerId) ?? []), l]);
    const cohort = cohortFor(players[0], byPlayer.get(players[0].id)!, players, byPlayer, false);
    check("no-positions cohort includes every teammate", cohort.length === 3);
    const data = buildReportCardData({
      team: { id: team.id, name: team.name },
      scopeLabel: "Full Season",
      player: players[0],
      playerLines: byPlayer.get(players[0].id)!,
      cohort,
      usesPositions: false,
    });
    check("report data flags the mode and uses universal stats", data.usesPositions === false && data.bankAccount.balance === 13);
    check("team comparison uses the same metric for everyone", data.cohort.every((c) => c.primaryStatLabel === "Kills / Match"));

    // Positions team: cohorts stay within the position group.
    const teamP = await prisma.team.create({ data: { name: "Test 16U", ageGroup: "16U", coachId: coach.id } });
    const lib = await prisma.player.create({ data: { teamId: teamP.id, name: "Jade", number: 5, primaryPosition: "L" } });
    const oh = await prisma.player.create({ data: { teamId: teamP.id, name: "Maya", number: 7, primaryPosition: "OH" } });
    const linesP = new Map<string, typeof lines>([
      [lib.id, [{ ...lines[0], playerId: lib.id, positionPlayed: "L" }]],
      [oh.id, [{ ...lines[0], playerId: oh.id, positionPlayed: "OH" }]],
    ]);
    const libCohort = cohortFor(lib, linesP.get(lib.id)!, [lib, oh], linesP, true);
    check("positions cohort stays within the position group", libCohort.length === 1 && libCohort[0].player.id === lib.id);
  } finally {
    await prisma.user.deleteMany({ where: { id: coach.id } });
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
