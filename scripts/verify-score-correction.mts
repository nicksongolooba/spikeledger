// Correcting the score by hand on the courtside page.
//
// Each team's score: tap the left side of the number to take a point off,
// the right side to add one, with a minus and a plus showing which is which.
// A hand change is a correction only: it never records or removes a stat,
// never moves the serve or the rotation, and never goes below 0. The parent
// live view must show the corrected score.
//
// Real touches (CDP Input.dispatchTouchEvent) on emulated iPhone 13 and
// Pixel 5. Creates its own coach, team, match and parent
// (@scorefix-test.local) and deletes them at the end. Needs a running server:
//   npm run build && npx next start -p 3220
//   BASE=http://127.0.0.1:3220 node --env-file=.env --import tsx scripts/verify-score-correction.mts

import bcrypt from "bcryptjs";
import { chromium, devices, type Browser, type CDPSession, type Page } from "playwright";
import { prisma } from "@/lib/prisma";

const BASE = process.env.BASE ?? "http://127.0.0.1:3220";
const run = Date.now().toString(36);
const PASSWORD = "scorefix-test";
const modalSel = 'div.fixed.inset-0.z-\\[100\\]';
const COURT = "div.h-52 button, div.sm\\:h-60 button";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); }
  else { failed += 1; console.error(`  ✗ ${name}${detail ? `  (${detail})` : ""}`); }
}

async function setUp(label: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const coach = await prisma.user.create({
    data: { email: `coach-${label}-${run}@scorefix-test.local`, name: "Coach", passwordHash, role: "COACH", plan: "COACH_PRO" },
  });
  const parent = await prisma.user.create({
    data: { email: `parent-${label}-${run}@scorefix-test.local`, name: "Parent", passwordHash, role: "PARENT" },
  });
  const team = await prisma.team.create({ data: { name: "Score Fix", ageGroup: "16U", coachId: coach.id, usesPositions: true } });
  const spec: [number, string][] = [[1, "OH"], [2, "OH"], [3, "MB"], [4, "MB"], [5, "S"], [6, "RS"], [7, "L"]];
  const players = [];
  for (const [n, pos] of spec) {
    players.push(await prisma.player.create({ data: { teamId: team.id, name: `P${n}`, number: n, primaryPosition: pos as never } }));
  }
  await prisma.parentPlayerLink.create({ data: { parentId: parent.id, playerId: players[0].id } });
  const t = await prisma.tournament.create({ data: { teamId: team.id, name: "Cup", startDate: new Date() } });
  const match = await prisma.match.create({ data: { tournamentId: t.id, opponent: "Rivals", matchNumber: 1 } });
  return { coach, parent, team, match, childId: players[0].id };
}

async function openEntry(page: Page, email: string, matchId: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  for (let i = 0; i < 60 && !page.url().includes("/dashboard"); i += 1) await page.waitForTimeout(500);
  if (!page.url().includes("/dashboard")) throw new Error(`login did not land: ${page.url()}`);
  await page.goto(`${BASE}/match/${matchId}/entry`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const tiles = page.locator(modalSel).locator("div.grid button");
  for (let n = 1; n <= 6; n += 1) await tiles.filter({ hasText: `P${n}` }).first().click();
  await page.locator(modalSel).locator('button:has-text("Start match")').click();
  await page.waitForTimeout(2000);
  const setStart = page.locator('button:has-text("Start set"), button:has-text("Confirm")');
  if (await setStart.count()) await setStart.first().click().catch(() => undefined);
  await page.waitForTimeout(1000);
}

// A parent's view of the live match, through the same endpoint the parent
// page polls. Signed in through NextAuth's credentials endpoint.
async function parentView(email: string) {
  const jar = new Map<string, string>();
  const send = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(BASE + path, {
      redirect: "manual",
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
    return res;
  };
  const { csrfToken } = await (await send("/api/auth/csrf")).json();
  await send("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email, password: PASSWORD, json: "true" }),
  });
  return async (teamId: string, playerId: string) => {
    const res = await send(`/api/parent/live?team=${teamId}&player=${playerId}`);
    return (await res.json()) as {
      currentSet: { setNumber: number; us: number; them: number } | null;
      sets: { setNumber: number; us: number; them: number; decided: "us" | "them" | null }[];
      setsTally: { us: number; them: number };
    };
  };
}

async function suite(browser: Browser, deviceName: string) {
  console.log(`\nScore corrections - ${deviceName}`);
  const label = deviceName.toLowerCase().replace(/\W/g, "");
  const { coach, parent, team, match, childId } = await setUp(label);
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const page = await ctx.newPage();
  try {
    await openEntry(page, coach.email, match.id);
    const cdp: CDPSession = await ctx.newCDPSession(page);
    await page.locator('[data-score="us"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const score = async (who: "us" | "them") => Number(await page.locator(`[data-score="${who}"]`).innerText());
    const board = async () => ({
      serving: (await page.locator('button[aria-label^="Serving"]').first().getAttribute("aria-label")) ?? "?",
      rotation: (await page.locator("text=/^R[1-6]$/").first().innerText().catch(() => "?")) ?? "?",
      court: (await page.$$eval("[data-court-slot]", (slots) =>
        slots.map((s) => `${s.querySelector("span.stat-number")?.textContent}:${(s.textContent ?? "").match(/#\d+/)?.[0]}`).sort().join(" "))),
    });
    // A real finger tap at a point on screen.
    const tapAt = async (x: number, y: number) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, radiusX: 8, radiusY: 8, force: 1 }] } as never);
      await page.waitForTimeout(50);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] } as never);
      await page.waitForTimeout(150);
    };
    // "Left side / right side of the number": a quarter of the way in from
    // each edge of the number itself.
    // Recording a stat scrolls the court into view, which can take the
    // scoreboard off screen; bring it to the middle before every tap.
    const showScore = () =>
      page.locator('[data-score="us"]').evaluate((el) => el.scrollIntoView({ block: "center" }));
    const tapNumber = async (who: "us" | "them", side: "left" | "right") => {
      await showScore();
      const b = (await page.locator(`[data-score="${who}"]`).boundingBox())!;
      await tapAt(side === "left" ? b.x + b.width * 0.25 : b.x + b.width * 0.75, b.y + b.height / 2);
    };
    const tapSign = async (who: "us" | "them", sign: "minus" | "plus") => {
      await showScore();
      const b = (await page.locator(`[data-score-${sign}="${who}"] span`).first().boundingBox())!;
      await tapAt(b.x + b.width / 2, b.y + b.height / 2);
    };
    const statTotals = async () => {
      const agg = await prisma.statLine.aggregate({
        where: { matchId: match.id },
        _sum: { kills: true, aces: true, blocks: true, digs: true, assists: true, attackErrors: true, serveErrors: true },
      });
      return JSON.stringify(agg._sum);
    };
    const serverSet = async () => {
      await page.waitForTimeout(1200); // the page syncs the score 400ms after the last change
      const row = await prisma.matchSetScore.findUnique({ where: { matchId_setNumber: { matchId: match.id, setNumber: 1 } } });
      return row ? `${row.us}-${row.them}` : "none";
    };
    const live = await parentView(parent.email);

    // --- the signs ---------------------------------------------------------
    for (const who of ["us", "them"] as const) {
      const num = (await page.locator(`[data-score="${who}"]`).boundingBox())!;
      const minus = (await page.locator(`[data-score-minus="${who}"] span`).first().boundingBox())!;
      const plus = (await page.locator(`[data-score-plus="${who}"] span`).first().boundingBox())!;
      check(`${who}: a minus sign shows on the left of the number and a plus on the right`,
        minus.x + minus.width <= num.x + num.width / 2 && plus.x >= num.x + num.width / 2 && (await page.locator(`[data-score-minus="${who}"] svg`).count()) === 1);
    }

    // --- a real stat first, so we can see hand changes leave it alone ------
    await page.locator(COURT).filter({ hasText: "#4" }).first().tap();
    await page.waitForTimeout(400);
    await page.locator('[data-action="KILL"]').first().click();
    await page.waitForTimeout(1500);
    const statsAfterKill = await statTotals();
    check("a recorded kill scored us a point", (await score("us")) === 1, String(await score("us")));
    const b0 = await board();

    // --- add and take off, both teams -------------------------------------
    await tapNumber("us", "right");
    await tapNumber("us", "right");
    check("tapping the right side of our number adds a point each time", (await score("us")) === 3, String(await score("us")));
    await tapNumber("us", "left");
    check("tapping the left side of our number takes one off", (await score("us")) === 2, String(await score("us")));
    await tapSign("them", "plus");
    await tapSign("them", "plus");
    await tapSign("them", "plus");
    check("the opponent's plus adds points the same way", (await score("them")) === 3, String(await score("them")));
    await tapNumber("them", "left");
    check("tapping the left side of their number takes one off", (await score("them")) === 2, String(await score("them")));
    await tapSign("us", "minus");
    check("our minus sign takes a point off", (await score("us")) === 1, String(await score("us")));
    // Two quick taps are two points, not a double-tap zoom.
    await tapSign("us", "plus");
    await tapSign("us", "plus");
    check("two quick taps on plus add two points", (await score("us")) === 3, String(await score("us")));

    const b1 = await board();
    check("hand changes did not change the serving team", b1.serving === b0.serving, `${b0.serving} -> ${b1.serving}`);
    check("hand changes did not change the rotation", b1.rotation === b0.rotation, `${b0.rotation} -> ${b1.rotation}`);
    check("hand changes did not move anyone on court", b1.court === b0.court);
    check("hand changes recorded no stat and removed none", (await statTotals()) === statsAfterKill, `${statsAfterKill} -> ${await statTotals()}`);

    // --- the server and the parent see the corrected score ---------------
    check("the corrected score reached the server", (await serverSet()) === "3-2", await serverSet());
    let snap = await live(team.id, childId);
    check("the parent live view shows the corrected score", snap.currentSet?.us === 3 && snap.currentSet?.them === 2, JSON.stringify(snap.currentSet));
    await tapNumber("us", "left");
    await tapNumber("them", "left");
    await serverSet();
    snap = await live(team.id, childId);
    check("and follows a point taken off", snap.currentSet?.us === 2 && snap.currentSet?.them === 1, JSON.stringify(snap.currentSet));

    // --- never below 0 ------------------------------------------------------
    await tapNumber("them", "left");
    check("the opponent is back to 0", (await score("them")) === 0);
    check("at 0 the minus is switched off", await page.locator('[data-score-minus="them"]').isDisabled());
    await tapNumber("them", "left");
    await tapSign("them", "minus");
    check("tapping minus at 0 leaves it at 0", (await score("them")) === 0, String(await score("them")));
    check("and does not touch our score", (await score("us")) === 2, String(await score("us")));
    check("the server never saw a negative score", (await serverSet()) === "2-0", await serverSet());

    // --- the end of a set: recorded as it works today ---------------------
    // Nothing on the courtside page ends a set; the 25-point, win-by-2 rule
    // only decides the win chance and the parent's W/L.
    for (let i = 0; i < 23; i += 1) await tapSign("us", "plus");
    for (let i = 0; i < 23; i += 1) await tapSign("them", "plus");
    check("hand taps reach 25-23", (await score("us")) === 25 && (await score("them")) === 23, `${await score("us")}-${await score("them")}`);
    const setTabs = await page.locator("button").filter({ hasText: /^Set \d$/ }).count();
    check("reaching 25-23 by hand does not start a new set", setTabs === 1, String(setTabs));
    check("the win chance reads 100%", ((await page.locator('button[aria-label^="Set win chance"]').getAttribute("aria-label")) ?? "").includes("100 percent"));
    await serverSet();
    snap = await live(team.id, childId);
    check("parents see set 1 marked won and a 1-0 set tally", snap.sets[0]?.decided === "us" && snap.setsTally.us === 1, JSON.stringify({ sets: snap.sets, tally: snap.setsTally }));
    await tapSign("us", "minus");
    check("a point off takes it to 24-23", (await score("us")) === 24);
    check("the win chance is no longer 100%", !((await page.locator('button[aria-label^="Set win chance"]').getAttribute("aria-label")) ?? "").includes("100 percent"));
    await serverSet();
    snap = await live(team.id, childId);
    check("parents see set 1 open again and the tally back to 0-0", snap.sets[0]?.decided === null && snap.setsTally.us === 0, JSON.stringify({ sets: snap.sets, tally: snap.setsTally }));
    const b2 = await board();
    check("still no serve or rotation change after all of it", b2.serving === b0.serving && b2.rotation === b0.rotation && b2.court === b0.court);
    check("and still no stat change", (await statTotals()) === statsAfterKill);
  } finally {
    await ctx.close();
    await prisma.user.deleteMany({ where: { id: { in: [coach.id, parent.id] } } });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await suite(browser, "iPhone 13");
    await suite(browser, "Pixel 5");
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.user.deleteMany({ where: { email: { endsWith: "@scorefix-test.local" } } });
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.user.deleteMany({ where: { email: { endsWith: "@scorefix-test.local" } } }).catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
