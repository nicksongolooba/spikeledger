// A rate with no denominator is not a low rate, it is an unmeasured one.
//
// No button on the courtside pad records an attack attempt or a serve attempt.
// safeDiv returns 0 when the denominator is 0, and 0 clears every "is this
// below the bar" test, so a number that was never collected read as the worst
// possible one. Every courtside-recorded player was being told to fix their
// shot selection.
//
// Run:  node --env-file=.env --import tsx scripts/verify-improvement-guards.mts

import { prisma } from "@/lib/prisma";
import { computeDerivedStats } from "@/engine/derived-stats";
import { computeImprovementAreas } from "@/components/reports/utils/improvement-rules";
import type { StatLine } from "@prisma/client";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); }
  else { failed += 1; console.error(`  ✗ ${name}${detail ? `  (${detail})` : ""}`); }
}

function line(over: Partial<StatLine>): StatLine {
  return {
    id: "x", matchId: "m", playerId: "p",
    kills: 0, attackErrors: 0, attackAttempts: 0,
    aces: 0, serveErrors: 0, serveAttempts: 0,
    blocks: 0, blockErrors: 0, assists: 0, settingErrors: 0,
    sr0: 0, sr1: 0, sr2: 0, sr3: 0,
    generalErrors: 0, digs: 0, setsPlayed: 4, didNotPlay: false, positionPlayed: null,
    ...over,
  } as unknown as StatLine;
}

const EFFICIENCY_METRICS = ["Shot selection", "Quick attack efficiency"];
const SERVE_METRICS = ["Serve consistency"];

function areasFor(lines: StatLine[], pos: "OH" | "MB", universal = false) {
  const ds = computeDerivedStats(lines, pos, universal ? "universal" : "positions");
  return computeImprovementAreas(ds, pos, "Sam", { universal });
}

function main() {
  console.log("\n1. Courtside data, where no attempt is ever recorded");
  // A real courtside line: kills and errors recorded, attempts never.
  const courtside = [line({ kills: 4, attackErrors: 3, aces: 1, serveErrors: 4, digs: 6, sr2: 3, sr1: 4 })];
  for (const pos of ["OH", "MB"] as const) {
    const metrics = areasFor(courtside, pos).map((a) => a.metric);
    check(
      `${pos}: no efficiency rule fires without attempts`,
      !metrics.some((m) => EFFICIENCY_METRICS.includes(m)),
      metrics.join(", "),
    );
    check(
      `${pos}: no serve-rate rule fires without attempts`,
      !metrics.some((m) => SERVE_METRICS.includes(m)),
      metrics.join(", "),
    );
    check(`${pos}: the player still gets advice`, areasFor(courtside, pos).length > 0);
  }

  console.log("\n2. Imported data, where attempts are recorded");
  const measuredBad = [line({ kills: 4, attackErrors: 6, attackAttempts: 40, aces: 1, serveErrors: 8, serveAttempts: 20 })];
  const badMetrics = areasFor(measuredBad, "OH").map((a) => a.metric);
  check("a genuinely low efficiency still fires", badMetrics.some((m) => EFFICIENCY_METRICS.includes(m)), badMetrics.join(", "));
  check("a genuinely high serve error rate still fires", badMetrics.some((m) => SERVE_METRICS.includes(m)), badMetrics.join(", "));

  const measuredGood = [line({ kills: 20, attackErrors: 2, attackAttempts: 40, aces: 3, serveErrors: 1, serveAttempts: 30 })];
  const goodMetrics = areasFor(measuredGood, "OH").map((a) => a.metric);
  check("a good efficiency does not fire", !goodMetrics.some((m) => EFFICIENCY_METRICS.includes(m)), goodMetrics.join(", "));

  console.log("\n3. The totals are exposed so the difference is visible");
  const ds = computeDerivedStats(courtside, "OH", "positions");
  check("attempts total is zero for courtside data", ds.totalAttackAttempts === 0);
  check("and non-zero for imported data", computeDerivedStats(measuredBad, "OH", "positions").totalAttackAttempts === 40);
  check("efficiency still reads 0 when unmeasured", ds.hittingEfficiency === 0);
}

async function impact() {
  console.log("\n4. How many real players were affected");
  const lines = await prisma.statLine.findMany({
    where: { didNotPlay: false },
    include: { player: { select: { primaryPosition: true } },
               match: { select: { tournament: { select: { team: { select: { name: true, usesPositions: true } } } } } } },
  });
  const byPlayer = new Map<string, typeof lines>();
  for (const l of lines) {
    const arr = byPlayer.get(l.playerId) ?? [];
    arr.push(l);
    byPlayer.set(l.playerId, arr);
  }
  let affected = 0;
  let total = 0;
  for (const [, ls] of byPlayer) {
    const uses = ls[0].match.tournament.team.usesPositions;
    const pos = ls[0].positionPlayed ?? ls[0].player.primaryPosition;
    const ds = computeDerivedStats(ls, pos, uses ? "positions" : "universal");
    total += 1;
    if (ds.totalAttackAttempts === 0) affected += 1;
  }
  console.log(`  players with no attack attempts recorded: ${affected} of ${total}`);
  console.log(`  they were previously told their efficiency was 0% and shown a shot-selection focus area.`);
}

main();
await impact();
console.log(`\n${passed} passed, ${failed} failed`);
await prisma.$disconnect();
if (failed > 0) process.exit(1);
