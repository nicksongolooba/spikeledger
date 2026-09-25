// Match format, ending sets, and one set rule everywhere.
//
//   Best of 3: sets 1-2 to 25, set 3 to 15. Best of 5: sets 1-4 to 25,
//   set 5 to 15. Win by 2, no cap. A match with no saved format (every match
//   from before formats existed) reads as best of 5, the old rule.
//
// Real touches (CDP) on emulated iPhone 13 and Pixel 5. Creates its own
// coach, team, matches and parents (@matchformat-test.local) and deletes
// them at the end. Needs a running server:
//   npm run build && npx next start -p 3221
//   BASE=http://127.0.0.1:3221 node --env-file=.env --import tsx scripts/verify-match-format.mts

import bcrypt from "bcryptjs";
import { chromium, devices, type Browser, type CDPSession, type Page } from "playwright";
import { prisma } from "@/lib/prisma";

const BASE = process.env.BASE ?? "http://127.0.0.1:3221";
const run = Date.now().toString(36);
const PASSWORD = "matchformat-test";
const DOMAIN = "@matchformat-test.local";
const modalSel = 'div.fixed.inset-0.z-\\[100\\]';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); }
  else { failed += 1; console.error(`  ✗ ${name}${detail ? `  (${detail})` : ""}`); }
}

async function setUpTeam(label: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const coach = await prisma.user.create({ data: { email: `coach-${label}-${run}${DOMAIN}`, name: "Coach", passwordHash, role: "COACH", plan: "COACH_PRO" } });
  const parent = await prisma.user.create({ data: { email: `parent-${label}-${run}${DOMAIN}`, name: "Parent", passwordHash, role: "PARENT" } });
  const team = await prisma.team.create({ data: { name: "Format Test", ageGroup: "16U", coachId: coach.id, usesPositions: true } });
  const spec: [number, string][] = [[1, "OH"], [2, "OH"], [3, "MB"], [4, "MB"], [5, "S"], [6, "RS"], [7, "L"]];
  const players = [];
  for (const [n, pos] of spec) players.push(await prisma.player.create({ data: { teamId: team.id, name: `P${n}`, number: n, primaryPosition: pos as never } }));
  await prisma.parentPlayerLink.create({ data: { parentId: parent.id, playerId: players[0].id } });
  const tournament = await prisma.tournament.create({ data: { teamId: team.id, name: "Cup", startDate: new Date() } });
  return { coach, parent, team, tournament, childId: players[0].id };
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  for (let i = 0; i < 60 && !page.url().includes("/dashboard"); i += 1) await page.waitForTimeout(500);
  if (!page.url().includes("/dashboard")) throw new Error(`login did not land: ${page.url()}`);
}

// Starting lineup, Start match, then the set-start question.
async function openEntry(page: Page, matchId: string) {
  await page.goto(`${BASE}/match/${matchId}/entry`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const tiles = page.locator(modalSel).locator("div.grid button");
  for (let n = 1; n <= 6; n += 1) await tiles.filter({ hasText: `P${n}` }).first().click();
  await page.locator(modalSel).locator('button:has-text("Start match")').click();
  await startSet(page);
}
async function startSet(page: Page) {
  await page.locator(modalSel).locator('button:has-text("Start set")').click({ timeout: 15000 });
  await page.waitForTimeout(700);
}

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
  return async (teamId: string, playerId: string) =>
    (await (await send(`/api/parent/live?team=${teamId}&player=${playerId}`)).json()) as {
      status: string;
      currentSet: { setNumber: number; us: number; them: number; winChancePct: number | null } | null;
      sets: { setNumber: number; us: number; them: number; decided: "us" | "them" | null }[];
      setsTally: { us: number; them: number };
      match: { setsWon: number; setsLost: number } | null;
    };
}

// Courtside helpers bound to one page.
function court(page: Page, cdp: CDPSession) {
  const tapAt = async (x: number, y: number) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, radiusX: 8, radiusY: 8, force: 1 }] } as never);
    await page.waitForTimeout(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] } as never);
    await page.waitForTimeout(110);
  };
  const sign = async (who: "us" | "them", s: "plus" | "minus", times = 1) => {
    for (let i = 0; i < times; i += 1) {
      await page.locator('[data-score="us"]').evaluate((el) => el.scrollIntoView({ block: "center" }));
      const b = (await page.locator(`[data-score-${s}="${who}"] span`).first().boundingBox())!;
      await tapAt(b.x + b.width / 2, b.y + b.height / 2);
    }
  };
  const score = async () => `${await page.locator('[data-score="us"]').innerText()}-${await page.locator('[data-score="them"]').innerText()}`;
  const setTo = async (us: number, them: number) => {
    const [u, t] = (await score()).split("-").map(Number);
    if (us > u) await sign("us", "plus", us - u);
    if (us < u) await sign("us", "minus", u - us);
    if (them > t) await sign("them", "plus", them - t);
    if (them < t) await sign("them", "minus", t - them);
    await page.waitForTimeout(250);
  };
  const setPrompt = async () => ((await page.locator('[data-end-prompt="set"]').count()) ? await page.locator('[data-end-prompt="set"]').innerText() : "");
  const matchPrompt = async () => ((await page.locator('[data-end-prompt="match"]').count()) ? await page.locator('[data-end-prompt="match"]').innerText() : "");
  const setTabs = () => page.locator("button").filter({ hasText: /^Set \d$/ }).count();
  return { sign, score, setTo, setPrompt, matchPrompt, setTabs };
}

// --------------------------------------------------------- Add match form
async function formSuite(browser: Browser, deviceName: string) {
  console.log(`\nAdd match form - ${deviceName}`);
  const t = await setUpTeam(`form-${deviceName.replace(/\W/g, "").toLowerCase()}`);
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const page = await ctx.newPage();
  try {
    await login(page, t.coach.email);
    await page.goto(`${BASE}/team/${t.team.id}/tournament/${t.tournament.id}`, { waitUntil: "networkidle" });
    for (const pick of [null, 5] as const) {
      await page.locator('button:has-text("Add match")').first().tap();
      await page.waitForTimeout(500);
      const pressed3 = await page.locator('[data-format-option="3"]').getAttribute("aria-pressed");
      if (pick === null) check(`${deviceName}: Best of 3 is picked by default`, pressed3 === "true");
      if (pick === 5) await page.locator('[data-format-option="5"]').tap();
      await page.fill("#m-opp", pick === 5 ? "Five Setters" : "Three Setters");
      await page.locator(modalSel).locator('button[type="submit"]').tap();
      await page.waitForTimeout(1500);
    }
    const made = await prisma.match.findMany({ where: { tournamentId: t.tournament.id }, select: { opponent: true, bestOf: true } });
    check(`${deviceName}: a default match is saved as best of 3`, made.find((m) => m.opponent === "Three Setters")?.bestOf === 3, JSON.stringify(made));
    check(`${deviceName}: picking Best of 5 saves best of 5`, made.find((m) => m.opponent === "Five Setters")?.bestOf === 5, JSON.stringify(made));
  } finally {
    await ctx.close();
    await prisma.user.deleteMany({ where: { id: { in: [t.coach.id, t.parent.id] } } });
  }
}

// ----------------------------------------------------- best of 3, played
async function bestOf3Suite(browser: Browser, deviceName: string, finish: "play-on" | "end-now") {
  console.log(`\nBest of 3 - ${deviceName}`);
  const t = await setUpTeam(`bo3-${deviceName.replace(/\W/g, "").toLowerCase()}`);
  const match = await prisma.match.create({ data: { tournamentId: t.tournament.id, opponent: "Rivals", matchNumber: 1, bestOf: 3 } });
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const page = await ctx.newPage();
  try {
    await login(page, t.coach.email);
    await openEntry(page, match.id);
    const cdp = await ctx.newCDPSession(page);
    const c = court(page, cdp);
    const live = await parentView(t.parent.email);

    check(`${deviceName}: the page shows the format`, (await page.locator("[data-format-button]").innerText()).includes("Best of 3"));
    check(`${deviceName}: an End set button is on screen`, (await page.locator("[data-end-set]").innerText()).includes("End set 1"));

    // A winning score asks and ends nothing; the score keeps working.
    await c.setTo(25, 22);
    check(`${deviceName}: 25-22 asks "Set 1: 25-22. End set?"`, (await c.setPrompt()).includes("Set 1: 25-22. End set?"), await c.setPrompt());
    check(`${deviceName}: and nothing ended by itself`, (await c.setTabs()) === 1);
    await c.sign("us", "minus");
    check(`${deviceName}: passing back through with minus clears the question`, (await c.setPrompt()) === "" && (await c.score()) === "24-22", await c.score());
    await c.sign("us", "plus");
    check(`${deviceName}: back to 25-22 asks again`, (await c.setPrompt()).includes("Set 1: 25-22"));
    await page.locator('[data-end-prompt="set"] button:has-text("Not yet")').tap();
    await page.waitForTimeout(300);
    check(`${deviceName}: Not yet puts the question away`, (await c.setPrompt()) === "" && (await c.setTabs()) === 1);
    await c.sign("us", "plus");
    check(`${deviceName}: a new winning score asks again`, (await c.setPrompt()).includes("Set 1: 26-22"));
    await c.sign("us", "minus");
    check(`${deviceName}: and after Not yet, coming back to 25-22 asks again`, (await c.setPrompt()).includes("Set 1: 25-22"), await c.setPrompt());

    // One tap ends it; the next set starts as it does today.
    await page.locator('[data-end-prompt="set"] button:has-text("End set")').tap();
    await page.waitForTimeout(600);
    check(`${deviceName}: End set starts set 2 with the serve and rotation question`, (await c.setTabs()) === 2 && (await page.locator(modalSel).innerText()).toLowerCase().includes("who serves first"));
    await startSet(page);
    check(`${deviceName}: set 2 starts at 0-0`, (await c.score()) === "0-0");

    await c.setTo(25, 20);
    await page.locator('[data-end-prompt="set"] button:has-text("End set")').tap();
    await page.waitForTimeout(600);
    check(`${deviceName}: winning set 2 asks "Match won 2-0. End match?"`, (await c.matchPrompt()).includes("Match won 2-0. End match?"), await c.matchPrompt());
    check(`${deviceName}: and no set 3 was started`, (await c.setTabs()) === 2);
    // Fixing a point after the question: it must not keep an old score.
    await c.sign("us", "minus");
    check(`${deviceName}: a point taken off clears the match question`, (await c.matchPrompt()) === "" && (await c.setPrompt()) === "", `${await c.matchPrompt()} | ${await c.setPrompt()}`);
    await c.sign("us", "plus");
    check(`${deviceName}: back at 25-20 it asks about the set again, not the match`, (await c.setPrompt()).includes("Set 2: 25-20") && (await c.matchPrompt()) === "");
    await page.locator('[data-end-prompt="set"] button:has-text("End set")').tap();
    await page.waitForTimeout(600);
    check(`${deviceName}: and ending it asks about the match again`, (await c.matchPrompt()).includes("Match won 2-0. End match?"));

    if (finish === "end-now") {
      await page.locator('[data-end-prompt="match"] button:has-text("End match")').tap();
      await page.waitForURL(/\/review/, { timeout: 30000 }).catch(() => undefined);
      const m = await prisma.match.findUnique({ where: { id: match.id } });
      check(`${deviceName}: End match from the question records a 2-0 win`, m?.result === "WIN" && m.setsWon === 2 && m.setsLost === 0, JSON.stringify({ r: m?.result, w: m?.setsWon, l: m?.setsLost }));
      return;
    }

    // Never blocked: play another set anyway. Set 3 goes to 15.
    await page.locator('[data-end-prompt="match"] button:has-text("Play another set")').tap();
    await page.waitForTimeout(600);
    await startSet(page);
    check(`${deviceName}: Play another set starts set 3`, (await c.setTabs()) === 3);
    await c.setTo(14, 14);
    check(`${deviceName}: set 3 at 14-14 asks nothing`, (await c.setPrompt()) === "");
    await c.setTo(15, 14);
    check(`${deviceName}: 15-14 is not a win (win by 2)`, (await c.setPrompt()) === "");
    await c.setTo(16, 14);
    check(`${deviceName}: 16-14 in set 3 asks (set 3 is to 15)`, (await c.setPrompt()).includes("Set 3: 16-14. End set?"), await c.setPrompt());
    await c.setTo(15, 13);
    check(`${deviceName}: 15-13 wins set 3`, (await c.setPrompt()).includes("Set 3: 15-13. End set?"), await c.setPrompt());

    // Parents see the same rule.
    await page.waitForTimeout(1500);
    const snap = await live(t.team.id, t.childId);
    check(`${deviceName}: parents see sets 1-3 all won by the same rule`, snap.sets.map((s) => s.decided).join() === "us,us,us", JSON.stringify(snap.sets));
    check(`${deviceName}: and the set 3 win chance at 100%`, snap.currentSet?.setNumber === 3 && snap.currentSet?.winChancePct === 100, JSON.stringify(snap.currentSet));

    // End match with the last set finished: no question.
    await page.locator('[data-end-prompt="set"] button:has-text("Not yet")').tap();
    await page.locator('header button:has-text("End match")').tap();
    await page.waitForURL(/\/review/, { timeout: 30000 }).catch(() => undefined);
    const m = await prisma.match.findUnique({ where: { id: match.id } });
    check(`${deviceName}: End match with every set finished goes straight to the report`, page.url().includes("/review"));
    check(`${deviceName}: and counts the finished sets (3-0)`, m?.result === "WIN" && m.setsWon === 3 && m.setsLost === 0, JSON.stringify({ r: m?.result, w: m?.setsWon, l: m?.setsLost }));
  } finally {
    await ctx.close();
    await prisma.user.deleteMany({ where: { id: { in: [t.coach.id, t.parent.id] } } });
  }
}

// ------------------------------- no saved format, changing it, unfinished
async function legacySuite(browser: Browser, deviceName: string) {
  console.log(`\nNo saved format, changing it, unfinished sets - ${deviceName}`);
  const t = await setUpTeam(`legacy-${deviceName.replace(/\W/g, "").toLowerCase()}`);
  const match = await prisma.match.create({ data: { tournamentId: t.tournament.id, opponent: "Old Rivals", matchNumber: 1 } });
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const page = await ctx.newPage();
  try {
    await login(page, t.coach.email);
    await openEntry(page, match.id);
    const cdp = await ctx.newCDPSession(page);
    const c = court(page, cdp);
    const live = await parentView(t.parent.email);
    check(`${deviceName}: a match with no saved format reads as Best of 5`, (await page.locator("[data-format-button]").innerText()).includes("Best of 5"));

    // The "+" tab still adds sets at any time.
    await page.locator('button[aria-label="Add set"]').tap();
    await startSet(page);
    await page.locator('button[aria-label="Add set"]').tap();
    await startSet(page);
    check(`${deviceName}: the + tab still adds sets`, (await c.setTabs()) === 3);
    await c.setTo(15, 13);
    check(`${deviceName}: best of 5 set 3 at 15-13 asks nothing (to 25)`, (await c.setPrompt()) === "");

    // Change the format: set 3 becomes the deciding set, to 15.
    await page.locator("[data-format-button]").tap();
    await page.waitForTimeout(400);
    await page.locator('[data-format-option="3"]').tap();
    await page.waitForTimeout(1200);
    check(`${deviceName}: the format can be changed on the page`, (await page.locator("[data-format-button]").innerText()).includes("Best of 3"));
    check(`${deviceName}: and it is saved`, (await prisma.match.findUnique({ where: { id: match.id } }))?.bestOf === 3);
    check(`${deviceName}: as best of 3, set 3 at 15-13 asks to end`, (await c.setPrompt()).includes("Set 3: 15-13. End set?"), await c.setPrompt());
    const snap3 = await live(t.team.id, t.childId);
    check(`${deviceName}: parents follow the new format`, snap3.currentSet?.winChancePct === 100 && snap3.sets[2]?.decided === "us", JSON.stringify(snap3.sets));
    await page.locator("[data-format-button]").tap();
    await page.waitForTimeout(400);
    await page.locator('[data-format-option="5"]').tap();
    await page.waitForTimeout(1200);
    check(`${deviceName}: back to best of 5, the question goes`, (await c.setPrompt()) === "" && (await prisma.match.findUnique({ where: { id: match.id } }))?.bestOf === 5);

    // End set on an unfinished set asks first; "Keep playing" changes nothing.
    await page.locator("[data-end-set]").tap();
    await page.waitForTimeout(400);
    const askSet = await page.locator("[data-confirm-end-set]").innerText().catch(() => "");
    check(`${deviceName}: ending an unfinished set asks first`, askSet.includes("Set 3 is 15-13 and not finished. End it anyway?"), askSet);
    await page.locator('button:has-text("Keep playing")').tap();
    await page.waitForTimeout(300);
    check(`${deviceName}: Keep playing leaves it as it was`, (await c.setTabs()) === 3 && (await c.score()) === "15-13");
    await page.locator("[data-end-set]").tap();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("End set anyway")').tap();
    await page.waitForTimeout(600);
    await startSet(page);
    check(`${deviceName}: End set anyway starts set 4`, (await c.setTabs()) === 4);

    // End match with an unfinished last set asks first.
    await c.setTo(3, 1);
    await page.locator('header button:has-text("End match")').tap();
    await page.waitForTimeout(400);
    const askMatch = await page.locator("[data-confirm-end-match]").innerText().catch(() => "");
    check(`${deviceName}: End match with set 4 unfinished asks first`, askMatch.includes("Set 4 is 3-1 and not finished. End the match anyway?"), askMatch);
    await page.locator('button:has-text("Keep playing")').tap();
    await page.waitForTimeout(300);
    check(`${deviceName}: Keep playing stays on the page`, page.url().includes("/entry"));
    await page.locator('header button:has-text("End match")').tap();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("End match anyway")').tap();
    await page.waitForURL(/\/review/, { timeout: 30000 }).catch(() => undefined);
    const m = await prisma.match.findUnique({ where: { id: match.id } });
    check(`${deviceName}: unfinished sets count for nobody (0-0 draw)`, m?.result === "DRAW" && m.setsWon === 0 && m.setsLost === 0, JSON.stringify({ r: m?.result, w: m?.setsWon, l: m?.setsLost }));

    // A finished match's format is locked.
    await page.goto(`${BASE}/match/${match.id}/entry`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    check(`${deviceName}: a finished match shows its format but can't change it`, (await page.locator("[data-format-button]").count()) === 0 && (await page.locator("[data-format-label]").innerText()).includes("Best of 5"));
    const res = await page.evaluate(async (id) => (await fetch(`/api/matches/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bestOf: 3 }) })).status, match.id);
    check(`${deviceName}: and the server refuses a format change after the end`, res === 409, String(res));
  } finally {
    await ctx.close();
    await prisma.user.deleteMany({ where: { id: { in: [t.coach.id, t.parent.id] } } });
  }
}

// --------------------------------------- five sets and nobody ahead
async function fiveSetSuite(browser: Browser, deviceName: string) {
  console.log(`\nFive sets, nobody ahead - ${deviceName}`);
  const t = await setUpTeam(`five-${deviceName.replace(/\W/g, "").toLowerCase()}`);
  const match = await prisma.match.create({ data: { tournamentId: t.tournament.id, opponent: "Long Match", matchNumber: 1, bestOf: 5 } });
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const page = await ctx.newPage();
  try {
    await login(page, t.coach.email);
    await openEntry(page, match.id);
    const c = court(page, await ctx.newCDPSession(page));
    // Bring a button to the middle of the screen first: at the bottom edge it
    // sits under the phone's fixed bottom bars.
    // The site scrolls smoothly, so jump there instantly, let it settle, and
    // tap with a real touch at the button's resting place.
    const cdp2 = await ctx.newCDPSession(page);
    const tapCentered = async (selector: string) => {
      const el = page.locator(selector).first();
      await el.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }));
      await page.waitForTimeout(300);
      const b = (await el.boundingBox())!;
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;
      await cdp2.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, radiusX: 8, radiusY: 8, force: 1 }] } as never);
      await page.waitForTimeout(40);
      await cdp2.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] } as never);
      await page.waitForTimeout(150);
    };
    const endByPrompt = async () => {
      await tapCentered('[data-end-prompt="set"] button:has-text("End set")');
      await page.waitForTimeout(600);
    };
    await c.setTo(25, 20); await endByPrompt(); await startSet(page);
    await c.setTo(20, 25); await endByPrompt(); await startSet(page);
    await c.setTo(5, 3);
    await tapCentered("[data-end-set]");
    await page.waitForTimeout(400);
    await page.locator('button:has-text("End set anyway")').tap();
    await page.waitForTimeout(600);
    await startSet(page);
    await c.setTo(25, 20); await endByPrompt(); await startSet(page);
    await c.setTo(13, 15);
    check(`${deviceName}: set 5 at 13-15 asks to end the set`, (await c.setPrompt()).includes("Set 5: 13-15. End set?"), await c.setPrompt());
    await endByPrompt();
    check(`${deviceName}: ending set 5 with nobody ahead asks about the match instead of ending it`, (await c.matchPrompt()).includes("All 5 sets played, 2-2. End match?"), await c.matchPrompt());
    check(`${deviceName}: and the match is still open`, page.url().includes("/entry") && (await prisma.match.findUnique({ where: { id: match.id } }))?.result === null);
    await tapCentered('[data-end-prompt="match"] button:has-text("Not yet")');
    await page.waitForTimeout(400);
    check(`${deviceName}: Not yet puts both questions away`, (await c.matchPrompt()) === "" && (await c.setPrompt()) === "");
    await page.locator('header button:has-text("End match")').tap();
    await page.waitForURL(/\/review/, { timeout: 30000 }).catch(() => undefined);
    const m = await prisma.match.findUnique({ where: { id: match.id } });
    check(`${deviceName}: End match then records the 2-2 draw (set 3 counts for nobody)`, m?.result === "DRAW" && m.setsWon === 2 && m.setsLost === 2, JSON.stringify({ r: m?.result, w: m?.setsWon, l: m?.setsLost }));
  } finally {
    await ctx.close();
    await prisma.user.deleteMany({ where: { id: { in: [t.coach.id, t.parent.id] } } });
  }
}

// ------------------------------------------- past matches don't change
async function pastSuite(browser: Browser) {
  console.log("\nPast matches");
  const t = await setUpTeam("past");
  try {
    // A finished match from before formats: no format saved, a 15-12 third
    // set and a 0-0 fourth row (from "+"), result stored by the old End match.
    const m = await prisma.match.create({
      data: { tournamentId: t.tournament.id, opponent: "Last Season", matchNumber: 1, result: "WIN", setsWon: 2, setsLost: 1, startedAt: new Date() },
    });
    const rows = [[25, 20], [20, 25], [15, 12], [0, 0]];
    for (const [i, [us, them]] of rows.entries()) {
      await prisma.matchSetScore.create({ data: { matchId: m.id, setNumber: i + 1, us, them, history: [] } });
    }
    await prisma.statLine.create({ data: { matchId: m.id, playerId: t.childId, kills: 1 } });
    const live = await parentView(t.parent.email);
    const snap = await live(t.team.id, t.childId);
    check("a finished match with no format keeps the old marks (set 3 at 15-12 is not a win, as before)", snap.sets.map((s) => s.decided).join() === "us,them,,", JSON.stringify(snap.sets));
    check("and keeps its stored result", snap.status === "final" && snap.match?.setsWon === 2 && snap.match?.setsLost === 1, JSON.stringify(snap.match));
    const stored = await prisma.match.findUnique({ where: { id: m.id }, select: { bestOf: true, result: true, setsWon: true, setsLost: true } });
    check("nothing was written to it", stored?.bestOf === null && stored.result === "WIN" && stored.setsWon === 2 && stored.setsLost === 1, JSON.stringify(stored));
    const ctx = await browser.newContext({ ...devices["Pixel 5"] });
    const page = await ctx.newPage();
    await login(page, t.coach.email);
    await page.goto(`${BASE}/match/${m.id}/entry`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    check("its courtside page claims no format it never had", (await page.locator("[data-format-label], [data-format-button]").count()) === 0);
    await ctx.close();
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [t.coach.id, t.parent.id] } } });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await formSuite(browser, "iPhone 13");
    await formSuite(browser, "Pixel 5");
    await bestOf3Suite(browser, "iPhone 13", "play-on");
    await bestOf3Suite(browser, "Pixel 5", "end-now");
    await legacySuite(browser, "iPhone 13");
    await legacySuite(browser, "Pixel 5");
    await fiveSetSuite(browser, "iPhone 13");
    await pastSuite(browser);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } }).catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
