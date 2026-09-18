// Playing time must not become a weapon.
//
// A parent who can total up how much their child played will eventually email
// the coach about it. That coach turns parent access off and warns the others,
// and the feature that spreads SpikeLedger through the stands dies. So the
// parent view is about what the child did, never about what they did not get
// to do.
//
// What this asserts, with the team setting both on and off:
//   - no parent-facing surface renders a count of sets, matches or appearances
//   - the live payload carries the current moment only, never a per-set history
//   - once a match is over, nothing is said about where the child was standing
//   - generated copy cannot mention playing time, and the prompts cannot even
//     show the model the numbers
//
// Creates throwaway rows with @playtime-test.local emails and deletes them in a
// finally block.
//
// Run:  node --env-file=.env --import tsx scripts/verify-parent-playing-time.mts
// Add BASE=http://127.0.0.1:3214 to also scan the rendered pages over HTTP.

import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { buildLivePayload, buildParentPlayerView, getMatchLive, getTeamLive } from "@/lib/parent-view";
import { invalidateLive } from "@/lib/live-cache";
import { playingTimeMentionIn } from "@/lib/generated-copy-guard";
import { playerStateCopy } from "@/lib/player-state-copy";
import { buildPlayerUserPrompt } from "@/engine/ai/prompts";
import { generateRuleBasedPlayerInsight } from "@/engine/ai/rule-based";
import { baselineFromLines } from "@/lib/court-state";
import { calculateBankAccount } from "@/engine/bank-account";
import type { StatLine } from "@prisma/client";

const BASE = process.env.BASE ?? null;

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
const email = (who: string) => `${who}-${run}@playtime-test.local`;

// Visible text of an HTML page, so a scan sees what a parent sees.
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

async function main() {
  const coach = await prisma.user.create({
    data: { email: email("coach"), name: "Coach", passwordHash: "x", role: "COACH", plan: "FREE" },
  });
  const passwordHash = await bcrypt.hash("test1234", 10);
  const parent = await prisma.user.create({
    data: { email: email("parent"), name: "Parent", passwordHash, role: "PARENT" },
  });
  const cleanup = [coach.id, parent.id];
  let teamId: string | null = null;

  try {
    const team = await prisma.team.create({
      data: { name: "Playtime FC", coachId: coach.id, allowParentView: true, usesPositions: true },
    });
    teamId = team.id;
    const player = await prisma.player.create({
      data: { teamId: team.id, name: "Sofia Adeyemi", number: 7, primaryPosition: "OH" },
    });
    const other = await prisma.player.create({
      data: { teamId: team.id, name: "Ruby Chen", number: 3, primaryPosition: "MB" },
    });
    await prisma.parentPlayerLink.create({ data: { parentId: parent.id, playerId: player.id } });

    const tournament = await prisma.tournament.create({
      data: { teamId: team.id, name: "Winter Invitational", startDate: new Date() },
    });
    // A finished match, so the player has season history to count.
    const past = await prisma.match.create({
      data: { tournamentId: tournament.id, opponent: "Metro Tigers", matchNumber: 1, result: "WIN", setsWon: 2, setsLost: 0 },
    });
    await prisma.statLine.create({
      data: { matchId: past.id, playerId: player.id, positionPlayed: "OH", kills: 8, digs: 4, sr2: 6, sr3: 3, attackErrors: 2, setsPlayed: 4 },
    });
    // And one in progress.
    const live = await prisma.match.create({
      data: { tournamentId: tournament.id, opponent: "Central Thunder", matchNumber: 2, startedAt: new Date() },
    });
    await prisma.matchSetScore.create({ data: { matchId: live.id, setNumber: 1, us: 25, them: 22, history: [] } });
    await prisma.matchSetScore.create({ data: { matchId: live.id, setNumber: 2, us: 18, them: 14, history: [] } });
    await prisma.statLine.create({
      data: { matchId: live.id, playerId: player.id, positionPlayed: "OH", kills: 3, digs: 2, sr2: 3, sr3: 2, setsPlayed: 2 },
    });
    // Set 2: the child played earlier in the set and is off the court now.
    await prisma.matchCourtState.create({
      data: {
        matchId: live.id,
        setNumber: 2,
        onCourt: [other.id],
        appeared: [player.id, other.id],
        roster: [player.id, other.id],
        baseline: baselineFromLines([{ playerId: player.id, kills: 1, digs: 1 }]),
      },
    });

    const payloadFor = async () => {
      invalidateLive({ teamId: team.id, matchId: live.id });
      const t = await getTeamLive(team.id);
      const m = await getMatchLive(live.id);
      return buildLivePayload(t!, m, player.id);
    };

    // ---------------------------------------------------- the live payload
    console.log("\n1. The live payload, bench status ON");
    let snap = await payloadFor();
    check("the state describes this moment", snap.playerState === "off_court", snap.playerState);
    check("and there is a per-set figure to go with it", snap.setStats !== null);

    const json = JSON.stringify(snap);
    check("no per-set history is sent at all", !json.includes("courtStates") && !json.includes("appeared"));
    check("no roster is sent", !json.includes('"roster"'));
    check("no setsPlayed reaches the parent", !/setsPlayed/i.test(json));
    check("no matchesPlayed reaches the parent", !/matchesPlayed/i.test(json));
    const payloadMention = playingTimeMentionIn(json);
    // Set numbers and scores are the team's, not the child's participation.
    check("the payload carries no playing-time phrase", payloadMention === null, payloadMention ?? "");

    console.log("\n2. The live payload, bench status OFF");
    await prisma.team.update({ where: { id: team.id }, data: { showBenchStatusToParents: false } });
    snap = await payloadFor();
    check("nothing is said about where the child is", snap.playerState === "unknown", snap.playerState);
    check("and the per-set figure goes with it", snap.setStats === null);
    check("the score is still there", snap.currentSet?.us === 18 && snap.currentSet?.them === 14);
    check("the child's own stats are still there", snap.stats?.kills === 3);
    const offCopy = playerStateCopy(snap.playerState, "Sofia");
    check("no chip and no sentence", offCopy.chip === null && offCopy.message === null);

    console.log("\n3. Once the match is over");
    await prisma.team.update({ where: { id: team.id }, data: { showBenchStatusToParents: true } });
    await prisma.match.update({ where: { id: live.id }, data: { result: "WIN", setsWon: 2, setsLost: 1 } });
    snap = await payloadFor();
    check("the match is final", snap.status === "final");
    check("nothing is said about where the child was standing", snap.playerState === "unknown", snap.playerState);
    check("but what they recorded is still there", snap.stats?.kills === 3);
    check("and no per-set figure lingers", snap.setStats === null);

    // ------------------------------------------------- generated parent copy
    console.log("\n4. Generated copy");
    const view = await buildParentPlayerView(player.id);
    const parentLine = view?.parentFriendly ?? "";
    const lineMention = playingTimeMentionIn(parentLine);
    check("the plain-English sentence says nothing about playing time", lineMention === null, `${lineMention ?? ""} :: ${parentLine}`);

    // A real Bank Account result, so the prompt builder gets the shape it
    // actually receives in production.
    const fakeLine = {
      kills: 9, attackErrors: 2, attackAttempts: 20, aces: 2, serveErrors: 1, serveAttempts: 14,
      blocks: 2, blockErrors: 0, assists: 1, settingErrors: 0,
      sr0: 0, sr1: 2, sr2: 6, sr3: 4, generalErrors: 1, digs: 7,
      setsPlayed: 4, didNotPlay: false, positionPlayed: null,
      id: "x", matchId: "m", playerId: "p",
    } as unknown as StatLine;
    const ba = calculateBankAccount(fakeLine, "OH", "positions");
    const insightReq = {
      kind: "player",
      scope: "season",
      scopeId: null,
      scopeLabel: "Winter Invitational",
      ageGroup: "16U",
      usesPositions: true,
      player: { id: "p", name: "Sofia", position: "OH", positionGroup: "ATTACK", primaryPosition: "OH" },
      stats: { killsPerMatch: 2.1, errorsPerMatch: 1.2, srAverage: 2.3, srTotal: 18, matchesPlayed: 6, setsPlayed: 22 },
      bankAccount: ba,
      trend: [],
    } as unknown as Parameters<typeof generateRuleBasedPlayerInsight>[0];
    const insight = generateRuleBasedPlayerInsight(insightReq);
    for (const [where, text] of [
      ["summary", insight.summary ?? ""],
      ["parent sentence", insight.parentFriendly ?? ""],
      ...(insight.strengths ?? []).map((t, i) => [`strength ${i + 1}`, t] as [string, string]),
      ...(insight.improvements ?? []).map((t, i) => [`improvement ${i + 1}`, t] as [string, string]),
    ] as [string, string][]) {
      const m = playingTimeMentionIn(text);
      check(`rule-based ${where} is clean`, m === null, `${m ?? ""} :: ${text}`);
    }

    // The model cannot repeat a number it was never shown.
    const prompt = buildPlayerUserPrompt(
      insightReq as unknown as Parameters<typeof buildPlayerUserPrompt>[0],
    );
    check("the prompt never shows the model matchesPlayed", !/matchesPlayed/.test(prompt));
    check("nor setsPlayed", !/setsPlayed/.test(prompt));
    check("but it still carries the real stats", /killsPerMatch/.test(prompt));

    // ------------------------------------------------------ the guard itself
    console.log("\n5. The guard");
    for (const phrase of [
      "Sofia played in 4 sets this weekend",
      "across 8 matches she has 12 kills",
      "her court time was limited",
      "she was subbed out in set 3",
      "Sofia did not start this match",
      "6 sets of steady passing",
      "playing time has been limited",
    ]) {
      check(`caught: "${phrase.slice(0, 34)}"`, playingTimeMentionIn(phrase) !== null);
    }
    for (const allowed of [
      "2.1 kills per match and 1.2 errors per match",
      "Sofia is having a strong run in their outside hitter role this Winter Invitational.",
      "14 deposits against 5 errors so far this season.",
      "Serve receive 2.31, above the team average of 2.02.",
    ]) {
      const m = playingTimeMentionIn(allowed);
      check(`allowed: "${allowed.slice(0, 34)}"`, m === null, m ?? "");
    }

    // --------------------------------------------------- source-level checks
    console.log("\n6. The surfaces themselves");
    const parentPage = readFileSync("src/app/(parent)/parent/player/[playerId]/page.tsx", "utf8");
    check("the parent page renders no matchesPlayed", !/\{season\.matchesPlayed/.test(parentPage));
    const card01 = readFileSync("src/components/reports/cards/PerformanceOverview.tsx", "utf8");
    check("report card 01 renders no participation counts", !/stats\.matchesPlayed|stats\.setsPlayed/.test(card01));
    const cards = ["YourNumbers", "WhatToWorkOn", "BankAccountCard", "BreakdownPie"];
    const dirty = cards.filter((c) => {
      const src = readFileSync(`src/components/reports/cards/${c}.tsx`, "utf8");
      return /stats\.matchesPlayed|stats\.setsPlayed|data\.stats\.setsPlayed/.test(src);
    });
    check("no other parent report card renders one either", dirty.length === 0, dirty.join(", "));

    // ------------------------------------------------------------ over HTTP
    if (BASE) {
      console.log("\n7. The rendered pages");
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      try {
        for (const benchStatus of [true, false]) {
          await prisma.team.update({
            where: { id: team.id },
            data: { showBenchStatusToParents: benchStatus },
          });
          const ctx = await browser.newContext();
          const page = await ctx.newPage();
          await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
          await page.fill("#email", parent.email);
          await page.fill("#password", "test1234");
          await page.click('button[type="submit"]');
          await page.waitForURL(/\/parent/, { timeout: 30000 });

          for (const [label, url] of [
            ["my players", `${BASE}/parent`],
            ["the child's page", `${BASE}/parent/player/${player.id}`],
          ] as [string, string][]) {
            await page.goto(url, { waitUntil: "networkidle" });
            const text = visibleText(await page.content());
            const mention = playingTimeMentionIn(text);
            check(
              `bench status ${benchStatus ? "on" : "off"}: ${label} shows no playing time`,
              mention === null,
              mention ?? "",
            );
            check(
              `bench status ${benchStatus ? "on" : "off"}: ${label} shows no other player`,
              !text.includes("Ruby"),
            );
          }
          await ctx.close();
        }
      } finally {
        await browser.close();
      }
    } else {
      console.log("\n7. The rendered pages - skipped (set BASE to include these)");
    }
  } finally {
    if (teamId) {
      const reports = await prisma.report.findMany({ where: { teamId }, select: { id: true } });
      if (reports.length) await prisma.report.deleteMany({ where: { id: { in: reports.map((r) => r.id) } } });
    }
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
