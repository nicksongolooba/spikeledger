// The courtside page has several reachable states. Only the happy one was
// ever driven, which is how a page that renders a live match with nobody on
// the court shipped and stayed shipped.
//
// This drives every state, in both team modes:
//   no lineup, lineup set (ready), live, ended, and reopened mid-match.
//
// Needs a running server and Playwright's chromium:
//   npm run build && npx next start -p 3216
//   BASE=http://127.0.0.1:3216 node --env-file=.env --import tsx scripts/verify-courtside-states.mts
//
// Creates throwaway rows with @courtside-test.local emails and deletes them in
// a finally block.

import bcrypt from "bcryptjs";
import { chromium, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { canEnd, canRecord, matchState } from "@/lib/match-state";

const BASE = process.env.BASE ?? "http://127.0.0.1:3216";

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
const email = (who: string) => `${who}-${run}@courtside-test.local`;

async function signIn(page: Page, address: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", address);
  await page.fill("#password", "test1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

const modalSel = 'div.fixed.inset-0.z-\\[100\\]';
const courtCells = "div.h-52 button, div.sm\\:h-60 button";

async function setLineup(page: Page) {
  const modal = page.locator(modalSel);
  if ((await modal.count()) === 0) {
    await page.locator('button:has-text("Edit lineup"), button:has-text("Set the starting lineup")').first().click();
    await page.waitForTimeout(500);
  }
  const tiles = page.locator(modalSel).locator("div.grid button").filter({ hasText: "Player" });
  const n = await tiles.count();
  for (let i = 0; i < Math.min(6, n); i += 1) await tiles.nth(i).click();
  await page.locator(modalSel).locator('button:has-text("Start match")').click();
  await page.waitForTimeout(2000);
  // A serve/rotation prompt can follow the first lineup.
  const setStart = page.locator('button:has-text("Start set"), button:has-text("Confirm")');
  if (await setStart.count()) await setStart.first().click().catch(() => undefined);
  await page.waitForTimeout(1000);
}

async function main() {
  const passwordHash = await bcrypt.hash("test1234", 10);
  const coach = await prisma.user.create({
    data: { email: email("coach"), name: "Courtside Coach", passwordHash, role: "COACH", plan: "COACH_PRO" },
  });
  const cleanup = [coach.id];

  try {
    // ------------------------------------------------ the state machine
    console.log("\n1. The state machine");
    const base = { result: null, onCourtCount: 6, pointsScored: 0, statCount: 0 };
    check("no players on court is no_lineup", matchState({ ...base, onCourtCount: 0 }) === "no_lineup");
    check("six on court and nothing recorded is ready", matchState(base) === "ready");
    check("a point scored makes it live", matchState({ ...base, pointsScored: 1 }) === "live");
    check("a stat recorded makes it live", matchState({ ...base, statCount: 1 }) === "live");
    check("a result makes it ended", matchState({ ...base, result: "WIN" }) === "ended");
    check("a result wins even with nobody on court", matchState({ ...base, onCourtCount: 0, result: "WIN" }) === "ended");
    check("nothing may be recorded with no lineup", !canRecord("no_lineup"));
    check("recording is allowed when ready and when live", canRecord("ready") && canRecord("live"));
    check("a match with no lineup cannot be ended", !canEnd("no_lineup"));
    check("an ended match cannot be ended again", !canEnd("ended"));

    // ------------------------------------------------------- the browser
    const browser = await chromium.launch({ headless: true });
    try {
      for (const [mode, ageGroup, usesPositions] of [
        ["no positions", "13U", false],
        ["positions", "16U", true],
      ] as [string, string, boolean][]) {
        console.log(`\n2. ${mode} team (${ageGroup})`);
        const team = await prisma.team.create({
          data: { name: `Courtside ${ageGroup}`, ageGroup, coachId: coach.id, usesPositions },
        });
        const POS = usesPositions
          ? ["OH", "OH", "RS", "MB", "MB", "S", "S", "L", "DS", "OPP"]
          : Array(10).fill("UTIL");
        for (let i = 0; i < 10; i += 1) {
          await prisma.player.create({
            data: { teamId: team.id, name: `Player ${i + 1}`, number: i + 1, primaryPosition: POS[i] as never },
          });
        }
        const tournament = await prisma.tournament.create({
          data: { teamId: team.id, name: `${ageGroup} Cup`, startDate: new Date() },
        });
        const mk = (n: number) =>
          prisma.match.create({ data: { tournamentId: tournament.id, opponent: `Rivals ${n}`, matchNumber: n } });
        const [mDismiss, mLeave, mPlay] = await Promise.all([mk(1), mk(2), mk(3)]);

        const ctx = await browser.newContext({ viewport: { width: 1000, height: 1100 } });
        const page = await ctx.newPage();
        await signIn(page, coach.email);

        // --- STATE: no lineup, reached by dismissing the prompt ----------
        await page.goto(`${BASE}/match/${mDismiss.id}/entry`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1200);
        check(`${mode}: the lineup prompt opens`, (await page.locator(modalSel).count()) > 0);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(800);

        check(`${mode}: dismissing lands on the no-lineup state`, (await page.locator('[data-match-state="no_lineup"]').count()) === 1);
        const body = await page.locator("body").innerText();
        check(`${mode}: it says what is wrong`, body.includes("No one is on the court yet"));
        check(`${mode}: and what to do about it`, body.includes("Set the starting lineup"));
        check(`${mode}: no court grid is rendered`, (await page.locator(courtCells).count()) === 0);
        check(`${mode}: no opponent-error button exists`, (await page.locator('button:has-text("Opp error")').count()) === 0);
        check(`${mode}: no End match button exists`, (await page.locator('button:has-text("End match")').count()) === 0);
        check(`${mode}: the old count label is gone`, !body.includes("(0/6)"));
        check(`${mode}: there is a way back out`, (await page.locator(`a[href="/team/${team.id}/tournament/${tournament.id}"]`).count()) > 0);

        // Nothing was written by landing here.
        const after = await prisma.match.findUnique({
          where: { id: mDismiss.id },
          select: { opponentErrors: true, result: true, setScores: { select: { id: true } }, statLines: { select: { id: true } } },
        });
        check(`${mode}: nothing was written to the match`, after?.opponentErrors === 0 && after?.result === null && after?.setScores.length === 0 && after?.statLines.length === 0);

        // --- Cancel has a destination -----------------------------------
        await page.goto(`${BASE}/match/${mLeave.id}/entry`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1200);
        await page.locator(modalSel).locator('button:has-text("Leave match")').click();
        await page.waitForTimeout(1500);
        check(`${mode}: Leave match returns to the tournament`, page.url().includes(`/tournament/${tournament.id}`), page.url());

        // --- STATE: ready ------------------------------------------------
        await page.goto(`${BASE}/match/${mPlay.id}/entry`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1200);
        await setLineup(page);
        check(`${mode}: six players are on the court`, (await page.locator(courtCells).count()) === 6);
        const stateAttr = await page.locator("[data-match-state]").first().getAttribute("data-match-state");
        check(`${mode}: the page reports a startable match`, stateAttr === "ready" || stateAttr === "live", stateAttr ?? "none");
        check(`${mode}: End match is available now`, (await page.locator('button:has-text("End match")').count()) === 1);

        // --- STATE: live, by recording a stat -----------------------------
        await page.locator(courtCells).first().click();
        await page.waitForTimeout(400);
        const kill = page.locator('button:has-text("Kill")').first();
        check(`${mode}: a player can be tapped and an action offered`, (await kill.count()) > 0);
        await kill.click();
        await page.waitForTimeout(1500);
        const lines = await prisma.statLine.count({ where: { matchId: mPlay.id, kills: { gt: 0 } } });
        check(`${mode}: the stat is recorded`, lines === 1, String(lines));
        const liveAttr = await page.locator("[data-match-state]").first().getAttribute("data-match-state");
        check(`${mode}: the page reports live`, liveAttr === "live", liveAttr ?? "none");

        // --- STATE: reopened ----------------------------------------------
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
        check(`${mode}: reopening keeps the lineup`, (await page.locator(courtCells).count()) === 6);
        check(`${mode}: reopening does not reopen the prompt`, (await page.locator(modalSel).count()) === 0);

        // --- STATE: ended ---------------------------------------------------
        await page.locator('button:has-text("End match")').click();
        await page.waitForURL(/\/review/, { timeout: 30000 }).catch(() => undefined);
        await page.waitForTimeout(1200);
        check(`${mode}: ending goes to the match report`, page.url().includes("/review"), page.url());
        await page.goto(`${BASE}/match/${mPlay.id}/entry`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
        const endedBody = await page.locator("body").innerText();
        check(`${mode}: reopening a finished match says so`, endedBody.includes("This match is finished"));
        check(`${mode}: and does not reopen the lineup prompt`, (await page.locator(modalSel).count()) === 0);

        await ctx.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
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
