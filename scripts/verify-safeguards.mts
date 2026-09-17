// Three safeguards, checked against the real database and the real lib code.
//
//   1. Public share links: they expire, they can be revoked, they never carry
//      a full name, and they are kept out of search engines.
//   2. Rating language: nothing a child or a parent reads delivers a verdict,
//      and a negative balance is never the headline.
//   3. Courtside: a coach scoring a match is never blocked by the plan.
//
// Creates throwaway rows with @safeguards-test.local emails and deletes them in
// a finally block.
//
// Run:  node --import tsx scripts/verify-safeguards.mts
// Add BASE=http://127.0.0.1:3213 to also check the live pages over HTTP.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  RATING_INFO,
  calculateBankAccount,
  leadWithBalance,
  type Rating,
} from "@/engine/bank-account";
import {
  SHARE_LINK_TTL_DAYS,
  daysLeft,
  publicPlayerName,
  shareExpiryFrom,
  shareState,
} from "@/lib/share-links";
import {
  GRACE_TOURNAMENT_BANNER,
  LAST_FREE_TOURNAMENT_NOTICE,
  decideTournamentCreation,
  isGraceTournament,
  recordGraceTournament,
  teamHasMatchInProgress,
} from "@/lib/courtside-grace";
import { generateRuleBasedPlayerInsight } from "@/engine/ai/rule-based";
import { genderedWordIn } from "@/lib/generated-copy-guard";
import { PLAYER_SYSTEM_PROMPT, buildTeamSystemPrompt } from "@/engine/ai/prompts";
import { matchStartEmail } from "@/lib/email";
import { paymentFailedEmail } from "@/lib/dunning";
import { computeImprovementAreas } from "@/components/reports/utils/improvement-rules";
import { playerStateCopy } from "@/lib/player-state-copy";
import type { PlayerCourtState } from "@/lib/parent-view";
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

// Words no player-facing or parent-facing string may contain.
const VERDICT_WORDS = [
  "hurting",
  "hurts",
  "needs work",
  "poor",
  "weak",
  "failing",
  "liability",
  "underperforming",
  "letting the team down",
];

function verdictWordIn(text: string): string | null {
  const lower = text.toLowerCase();
  return VERDICT_WORDS.find((w) => lower.includes(w)) ?? null;
}

const run = Date.now().toString(36);
const email = (who: string) => `${who}-${run}@safeguards-test.local`;

function line(over: Partial<StatLine>): StatLine {
  return {
    id: "x", matchId: "m", playerId: "p",
    kills: 0, attackErrors: 0, attackAttempts: 0,
    aces: 0, serveErrors: 0, serveAttempts: 0,
    blocks: 0, blockErrors: 0, assists: 0, settingErrors: 0,
    sr0: 0, sr1: 0, sr2: 0, sr3: 0,
    generalErrors: 0, digs: 0, setsPlayed: 1, didNotPlay: false,
    positionPlayed: null,
    ...over,
  } as StatLine;
}

async function main() {
  const coach = await prisma.user.create({
    data: { email: email("coach"), name: "Free Coach", passwordHash: "x", role: "COACH", plan: "FREE" },
  });
  const cleanup = [coach.id];
  let createdTeamId: string | null = null;

  try {
    // ---------------------------------------------------------------- FIX 1
    console.log("\n1. Share links: expiry, revocation, names, indexing");

    check(`links last ${SHARE_LINK_TTL_DAYS} days`, SHARE_LINK_TTL_DAYS === 30);
    const future = shareExpiryFrom();
    check("a new link expires about 30 days out", daysLeft(future) === 30, String(daysLeft(future)));
    check("a fresh link is active", shareState({ expiresAt: future, revokedAt: null }) === "active");
    check(
      "a past expiry is expired",
      shareState({ expiresAt: new Date(Date.now() - 1000), revokedAt: null }) === "expired",
    );
    check(
      "revoked beats an expiry still in the future",
      shareState({ expiresAt: future, revokedAt: new Date() }) === "revoked",
    );
    check(
      "a link with no expiry at all is treated as expired, not permanent",
      shareState({ expiresAt: null, revokedAt: null }) === "expired",
    );

    check("a public name is a first name and a number", publicPlayerName("Sofia Adeyemi", 7) === "Sofia #7");
    check("a surname never survives", !publicPlayerName("Sofia Adeyemi", 7).includes("Adeyemi"));
    check("a middle name never survives", publicPlayerName("Ana Maria Ruiz Costa", 3) === "Ana #3");
    check("no number is handled", publicPlayerName("Sofia Adeyemi", null) === "Sofia");
    check("a missing name does not leak an empty label", publicPlayerName(null, 9) === "Player #9");

    // A real report row, to prove the default expiry is written.
    const team = await prisma.team.create({ data: { name: "Safeguard FC", coachId: coach.id } });
    createdTeamId = team.id;
    const report = await prisma.report.create({
      data: {
        teamId: team.id,
        type: "PLAYER_INDIVIDUAL",
        scope: "player:test|scope:Season",
        imageUrls: ["data:image/png;base64,iVBORw0KGgo="],
        expiresAt: shareExpiryFrom(),
        metadata: { playerName: "Sofia Adeyemi", displayName: "Sofia #7", scopeLabel: "Season" },
      },
    });
    check("a stored report is active and dated", shareState(report) === "active" && daysLeft(report.expiresAt) === 30);
    const revoked = await prisma.report.update({
      where: { id: report.id },
      data: { revokedAt: new Date() },
    });
    check("revoking takes effect immediately", shareState(revoked) === "revoked");

    // Robots and sitemap are source files, so they are read rather than fetched.
    const robots = readFileSync("src/app/robots.ts", "utf8");
    check("robots.txt disallows /share/", robots.includes('"/share/"'));
    const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
    check("the sitemap never emits a share URL", !sitemap.includes("/share/"));
    const sharePage = readFileSync("src/app/share/[id]/page.tsx", "utf8");
    check("the share page sets noindex and nofollow", sharePage.includes("index: false") && sharePage.includes("follow: false"));
    check("the share page never renders a stored full name", !/meta\.playerName\s*}/.test(sharePage));

    // ---------------------------------------------------------------- FIX 2
    console.log("\n2. Rating language");

    const expected: Record<Rating, string> = {
      GREEN: "Strong contribution",
      BLUE: "Solid",
      ORANGE: "Building",
      RED: "Focus area",
      GREY: "Not enough data yet",
    };
    for (const [rating, label] of Object.entries(expected) as [Rating, string][]) {
      check(`${rating} reads "${label}"`, RATING_INFO[rating].label === label, RATING_INFO[rating].label);
    }
    const allLabels = Object.values(RATING_INFO).map((r) => r.label).join(" ");
    check("no rating label carries a verdict word", verdictWordIn(allLabels) === null, verdictWordIn(allLabels) ?? "");

    check("a positive balance still leads", leadWithBalance(4));
    check("zero still leads", leadWithBalance(0));
    check("a negative balance never leads", !leadWithBalance(-4));

    // The maths is untouched: same inputs, same numbers.
    const rough = calculateBankAccount(
      line({ kills: 1, attackErrors: 6, serveErrors: 4, sr0: 5 }),
      "OH",
      "positions",
    );
    check("a poor line still computes a negative balance", rough.balance < 0, String(rough.balance));
    check("and is labelled as a focus area", rough.ratingLabel === "Focus area", rough.ratingLabel);
    check("deposits and withdrawals are both available to show instead", rough.deposits >= 0 && rough.withdrawals > 0);

    const insight = generateRuleBasedPlayerInsight({
      player: { name: "Sofia", position: "OH", number: 7 },
      usesPositions: true,
      scopeLabel: "Winter Invitational",
      ageGroup: "16U",
      stats: { killsPerMatch: 0.5, errorsPerMatch: 4, srAverage: 1.1, srTotal: 12, matchesPlayed: 3 },
      bankAccount: rough,
      trend: [],
    } as unknown as Parameters<typeof generateRuleBasedPlayerInsight>[0]);
    const insightText = [insight.summary, insight.parentFriendly, ...(insight.strengths ?? []), ...(insight.improvements ?? [])]
      .filter(Boolean)
      .join(" ");
    const badWord = verdictWordIn(insightText);
    check(`the rule-based insight for a struggling player carries no verdict word`, badWord === null, badWord ?? "");
    check(
      "and it does not open with a minus number",
      !/^\S+\s+-\s+Bank Account -/.test(insight.summary ?? ""),
      (insight.summary ?? "").slice(0, 60),
    );

    // Nothing anywhere in src renders the old labels.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const text = readFileSync(full, "utf8");
          // The AI prompts mention the word only to forbid it, and the engine
          // explains the decision in a comment.
          const forbidding = full.includes("prompts.ts") || full.includes("chat-context.ts") || full.includes("bank-account.ts");
          if (/Hurting Team|Helping Team Win|Solid Contributor|Needs Work/i.test(text)) offenders.push(full);
          else if (!forbidding && /\bhurting\b/i.test(text)) offenders.push(full);
        }
      }
    };
    walk("src");
    check("no old rating label survives anywhere in src", offenders.length === 0, offenders.join(", "));

    // ------------------------------------------------- FIX 17: gendered copy
    console.log("\n2b. Generated copy never guesses a pronoun");

    // Every player-facing generated string, put through one rule.
    const generated: [string, string][] = [];

    generated.push(["rule-based summary", insight.summary ?? ""]);
    generated.push(["rule-based parent line", insight.parentFriendly ?? ""]);
    for (const [i, t] of (insight.strengths ?? []).entries()) generated.push([`strength ${i + 1}`, t]);
    for (const [i, t] of (insight.improvements ?? []).entries()) generated.push([`improvement ${i + 1}`, t]);

    // What to work on, which lands on the parent page and report card 03.
    const areas = computeImprovementAreas(
      { srAverage: 1.1, srTotal: 20, killsPerMatch: 0.4, errorsPerMatch: 4.2, digsPerMatch: 1.1,
        acesPerMatch: 0.1, blocksPerMatch: 0.1, assistsPerMatch: 0.2, hittingEfficiency: -0.05,
        serveErrorPercentage: 0.34, matchesPlayed: 4, bankAccount: rough,
      } as unknown as Parameters<typeof computeImprovementAreas>[0],
      "OH",
      "Sofia",
      { universal: false },
    );
    for (const a of areas) {
      generated.push([`focus area: ${a.metric}`, `${a.metric} ${a.detail} ${a.current} ${a.target}`]);
    }

    // The player-state copy the parent view shows.
    for (const st of ["on_court", "off_court", "bench", "not_in_match", "unknown"] as PlayerCourtState[]) {
      const c = playerStateCopy(st, "Sofia");
      generated.push([`player state ${st}`, [c.chip, c.message, c.matchStatsLabel, c.setStatsLabel].filter(Boolean).join(" ")]);
    }

    // Emails.
    const startOne = matchStartEmail({ names: ["Sofia"], opponent: "Central Thunder", watchUrl: "https://x/y" });
    const startTwo = matchStartEmail({ names: ["Sofia", "Ana"], opponent: "Central Thunder", watchUrl: "https://x/y" });
    generated.push(["match start email, one child", `${startOne.subject} ${startOne.text}`]);
    generated.push(["match start email, siblings", `${startTwo.subject} ${startTwo.text}`]);
    for (const attempt of [1, 2, 3]) {
      const mail = paymentFailedEmail({ name: "Alex Kim", isClub: attempt !== 3, deadlineLabel: "October 1, 2026", attempt, url: "https://x/y" });
      generated.push([`payment failed email ${attempt}`, `${mail.subject} ${mail.text}`]);
    }

    // The instructions the AI writes under. If these carry a pronoun, the
    // model will happily copy it into something a parent reads.
    generated.push(["AI player system prompt", PLAYER_SYSTEM_PROMPT]);
    generated.push(["AI team system prompt", buildTeamSystemPrompt()]);

    let genderedHit: string | null = null;
    for (const [where, text] of generated) {
      const word = genderedWordIn(text);
      if (word) {
        genderedHit = `${where}: "${word}"`;
        break;
      }
    }
    check(
      `${generated.length} generated strings, none guessing a pronoun`,
      genderedHit === null,
      genderedHit ?? "",
    );
    check("the guard catches a pronoun when there is one", genderedWordIn("She passed well") === "she");
    check("and does not trip on other, there or this", genderedWordIn("The other player is there, this is fine") === null);

    // ---------------------------------------------------------------- FIX 3
    console.log("\n3. Courtside: a coach is never blocked mid-match");

    // No plan check may exist on any route the courtside screen calls.
    const courtsideRoutes = [
      "src/app/api/matches/[id]/stats/record/route.ts",
      "src/app/api/matches/[id]/stats/undo/route.ts",
      "src/app/api/matches/[id]/stats/route.ts",
      "src/app/api/matches/[id]/score/route.ts",
      "src/app/api/matches/[id]/lineup/route.ts",
      "src/app/api/matches/[id]/court/route.ts",
      "src/app/api/matches/[id]/start/route.ts",
      "src/app/api/matches/[id]/route.ts",
    ];
    const paywalled = courtsideRoutes.filter((f) => {
      const text = readFileSync(f, "utf8");
      return /canUserPerformAction|status:\s*402/.test(text);
    });
    check("no courtside route carries a plan check", paywalled.length === 0, paywalled.join(", "));

    // The free tier, tournament by tournament.
    const t1 = await decideTournamentCreation(coach.id, team.id, "FREE");
    check("the first tournament is allowed with nothing said", t1.allow && t1.notice === null && t1.because === "within-limit");
    await prisma.tournament.create({ data: { teamId: team.id, name: "T1", startDate: new Date() } });
    const t2 = await decideTournamentCreation(coach.id, team.id, "FREE");
    check("the second is allowed quietly too", t2.allow && t2.notice === null);
    await prisma.tournament.create({ data: { teamId: team.id, name: "T2", startDate: new Date() } });

    const t3 = await decideTournamentCreation(coach.id, team.id, "FREE");
    check("the third is allowed", t3.allow && !t3.grace);
    check("and the coach is told it was the last free one", t3.notice === LAST_FREE_TOURNAMENT_NOTICE, t3.notice ?? "none");
    const third = await prisma.tournament.create({ data: { teamId: team.id, name: "T3", startDate: new Date() } });

    const t4 = await decideTournamentCreation(coach.id, team.id, "FREE");
    check("the fourth is allowed as a courtesy", t4.allow && t4.grace && t4.because === "grace");
    const fourth = await prisma.tournament.create({ data: { teamId: team.id, name: "T4", startDate: new Date() } });
    await recordGraceTournament(coach.id, fourth.id);
    check("the courtesy tournament is marked", await isGraceTournament(coach.id, fourth.id));
    check("an ordinary tournament is not", !(await isGraceTournament(coach.id, third.id)));
    check("the banner says it is the last one", GRACE_TOURNAMENT_BANNER.includes("courtesy") && GRACE_TOURNAMENT_BANNER.includes("keep going"));

    const t5 = await decideTournamentCreation(coach.id, team.id, "FREE");
    check("the fifth is blocked, at a laptop", !t5.allow && t5.because === "blocked");
    check("with an upgrade reason to show", t5.reason !== null);
    check("the courtesy is only ever given once", (await decideTournamentCreation(coach.id, team.id, "FREE")).grace === false);

    // But not while a match is being scored.
    check("no match in progress yet", !(await teamHasMatchInProgress(team.id)));
    const liveMatch = await prisma.match.create({
      data: { tournamentId: fourth.id, opponent: "Anyone", matchNumber: 1, startedAt: new Date() },
    });
    check("a started, unfinished match counts as in progress", await teamHasMatchInProgress(team.id));
    const duringMatch = await decideTournamentCreation(coach.id, team.id, "FREE");
    check("the limit gives way while a match is live", duringMatch.allow && duringMatch.because === "match-in-progress");
    check("and says nothing about upgrading", duringMatch.notice === null && duringMatch.reason === null);

    await prisma.match.update({ where: { id: liveMatch.id }, data: { result: "WIN" } });
    check("the match ending restores the limit", !(await teamHasMatchInProgress(team.id)));
    check("and the block returns", !(await decideTournamentCreation(coach.id, team.id, "FREE")).allow);

    // A paid coach never sees any of this.
    const paid = await decideTournamentCreation(coach.id, team.id, "COACH_PRO");
    check("Coach Pro is unlimited and silent", paid.allow && paid.notice === null && !paid.grace);

    // ------------------------------------------------------------ over HTTP
    if (BASE) {
      console.log("\n4. Over HTTP");
      const robotsRes = await fetch(`${BASE}/robots.txt`);
      const robotsText = await robotsRes.text();
      check("robots.txt served with the share rule", robotsText.includes("/share/"));
      const sitemapRes = await fetch(`${BASE}/sitemap.xml`);
      const sitemapText = await sitemapRes.text();
      check("sitemap.xml lists no share URL", !sitemapText.includes("/share/"));

      const live = await prisma.report.create({
        data: {
          teamId: team.id,
          type: "PLAYER_INDIVIDUAL",
          scope: "player:test|scope:Season",
          imageUrls: ["data:image/png;base64,iVBORw0KGgo="],
          expiresAt: shareExpiryFrom(),
          metadata: { playerName: "Sofia Adeyemi", scopeLabel: "Season" },
        },
      });
      const liveHtml = await (await fetch(`${BASE}/share/${live.id}`)).text();
      check("an active share page renders", liveHtml.includes("Match report"));
      check("it carries noindex", /name="robots"[^>]*noindex/i.test(liveHtml) || /noindex/i.test(liveHtml));
      check("it never prints the full name", !liveHtml.includes("Adeyemi"));

      const dead = await prisma.report.update({
        where: { id: live.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const deadHtml = await (await fetch(`${BASE}/share/${dead.id}`)).text();
      check("an expired link shows the neutral notice", deadHtml.includes("This report link has expired"));
      check("and says nothing about who it was for", !deadHtml.includes("Adeyemi") && !deadHtml.includes("Sofia"));
      const og = await fetch(`${BASE}/api/reports/${dead.id}/og`);
      check("the preview image dies with the link", og.status === 404, String(og.status));
    } else {
      console.log("\n4. Over HTTP - skipped (set BASE to include these)");
    }
  } finally {
    // Reports carry a teamId but no foreign key, so deleting the user does not
    // take them with it. They are removed by hand, scoped to this run's team.
    if (createdTeamId) await prisma.report.deleteMany({ where: { teamId: createdTeamId } });
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
