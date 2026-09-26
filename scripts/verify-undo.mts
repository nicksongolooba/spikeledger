// Undo reverses everything one action did, and every red error button ends
// the rally for the other team.
//
//   - Set err and Dig err give the opponent the point and move the serve
//     exactly as Attack err does.
//   - Undo takes back the stat, the point that action gave (either team), the
//     serve and the rotation. Hand +/- changes made since stay. Actions that
//     gave no point only lose the stat. Undo goes back one action at a time,
//     in order. The score never goes below 0. An action from an ended set
//     asks first. After undo: "Undone: Attack err, P1. Score 0-0."
//
// Real touches (CDP) on emulated iPhone 13 and Pixel 5. Creates its own
// coach, team, match and parent (@undo-test.local) and deletes them.
// Needs a running server:
//   npm run build && npx next start -p 3223
//   BASE=http://127.0.0.1:3223 node --env-file=.env --import tsx scripts/verify-undo.mts

import bcrypt from "bcryptjs";
import { chromium, devices, type Browser, type CDPSession, type Page } from "playwright";
import { prisma } from "@/lib/prisma";

const BASE = process.env.BASE ?? "http://127.0.0.1:3223";
const run = Date.now().toString(36);
const PASSWORD = "undo-test";
const DOMAIN = "@undo-test.local";
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
  const coach = await prisma.user.create({ data: { email: `coach-${label}-${run}${DOMAIN}`, name: "Coach", passwordHash, role: "COACH", plan: "COACH_PRO" } });
  const parent = await prisma.user.create({ data: { email: `parent-${label}-${run}${DOMAIN}`, name: "Parent", passwordHash, role: "PARENT" } });
  const team = await prisma.team.create({ data: { name: "Undo Test", ageGroup: "16U", coachId: coach.id, usesPositions: true } });
  const spec: [number, string][] = [[1, "OH"], [2, "OH"], [3, "MB"], [4, "MB"], [5, "S"], [6, "RS"], [7, "L"]];
  const players = [];
  for (const [n, pos] of spec) players.push(await prisma.player.create({ data: { teamId: team.id, name: `P${n}`, number: n, primaryPosition: pos as never } }));
  await prisma.parentPlayerLink.create({ data: { parentId: parent.id, playerId: players[0].id } });
  const t = await prisma.tournament.create({ data: { teamId: team.id, name: "Cup", startDate: new Date() } });
  const match = await prisma.match.create({ data: { tournamentId: t.id, opponent: "Rivals", matchNumber: 1, bestOf: 3 } });
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
      currentSet: { setNumber: number; us: number; them: number } | null;
      sets: { setNumber: number; us: number; them: number }[];
    };
}

function courtside(page: Page, cdp: CDPSession) {
  // Jump there instantly (the page scrolls smoothly) and tap with a real
  // touch where the element settles.
  const tapEl = async (selector: string, opts: { center?: boolean } = { center: true }) => {
    const el = page.locator(selector).first();
    if (opts.center) {
      await el.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }));
      await page.waitForTimeout(200);
    }
    const b = (await el.boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, radiusX: 8, radiusY: 8, force: 1 }] } as never);
    await page.waitForTimeout(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] } as never);
    await page.waitForTimeout(150);
  };
  const score = async () => `${await page.locator('[data-score="us"]').innerText()}-${await page.locator('[data-score="them"]').innerText()}`;
  const board = async () => ({
    score: await score(),
    serving: (await page.locator('button[aria-label^="Serving"]').first().getAttribute("aria-label")) ?? "?",
    rotation: (await page.locator("text=/^R[1-6]$/").first().innerText().catch(() => "?")) ?? "?",
    court: await page.$$eval("[data-court-slot]", (slots) =>
      slots
        .map((s) => `${s.querySelector("span.stat-number")?.textContent}:${(s.textContent ?? "").match(/#\d+/)?.[0]}`)
        .sort()
        .join(" ")),
  });
  const same = (a: Awaited<ReturnType<typeof board>>, b: Awaited<ReturnType<typeof board>>) =>
    a.score === b.score && a.serving === b.serving && a.rotation === b.rotation && a.court === b.court;
  const show = (b: Awaited<ReturnType<typeof board>>) => `${b.score} ${b.serving} ${b.rotation}`;
  // Tap a court player until the stat pad shows them (or, with want "off",
  // until it is empty again). Like verify-swap, retry: an occasional tap on
  // this page does not register.
  const padOpen = async () => (await page.locator("[data-action]").count()) > 0;
  const select = async (jersey: number, want: "on" | "off" = "on") => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const card = page.locator(COURT).filter({ hasText: `#${jersey}` }).first();
      await card.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }));
      await page.waitForTimeout(200);
      const b = (await card.boundingBox())!;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, radiusX: 8, radiusY: 8, force: 1 }] } as never);
      await page.waitForTimeout(40);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] } as never);
      await page.waitForTimeout(400);
      if ((await padOpen()) === (want === "on")) return;
    }
  };
  // Tap a court player, then a button on the stat pad.
  const record = async (jersey: number, action: string) => {
    await select(jersey);
    await tapEl(`[data-action="${action}"]`);
    await page.waitForTimeout(700);
  };
  const sign = async (who: "us" | "them", s: "plus" | "minus") => tapEl(`[data-score-${s}="${who}"] span`);
  // The big undo button in the bar fixed at the bottom of the screen.
  const undo = async () => {
    await tapEl("button:has([data-undo-last])", { center: false });
    await page.waitForTimeout(250);
    const toast = await page.locator("text=/^Undone:/").last().innerText().catch(() => "");
    await page.waitForTimeout(700);
    return toast;
  };
  return { tapEl, board, same, show, select, record, sign, undo, score };
}

async function suite(browser: Browser, deviceName: string) {
  console.log(`\nUndo and rally-ending errors - ${deviceName}`);
  const label = deviceName.toLowerCase().replace(/\W/g, "");
  const { coach, parent, team, match, childId } = await setUp(label);
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const page = await ctx.newPage();
  const stat = async (field: "attackErrors" | "settingErrors" | "digErrors" | "kills" | "digs") => {
    const agg = await prisma.statLine.aggregate({ where: { matchId: match.id }, _sum: { [field]: true } as never });
    return Number((agg._sum as Record<string, number | null>)[field] ?? 0);
  };
  try {
    await openEntry(page, coach.email, match.id);
    const c = courtside(page, await ctx.newCDPSession(page));
    const live = await parentView(parent.email);

    // --- the rule, where the coach can see it ------------------------------
    await c.select(2); // the pad shows once a player is picked
    check(`${deviceName}: the red buttons' rule is on screen`, (await page.locator("[data-error-rule]").innerText()).includes("Red error buttons: this player's mistake lost the rally, so the other team gets the point."));
    await c.tapEl("[data-error-rule] button");
    const defs = await page.locator("[data-error-definitions]").innerText().catch(() => "");
    check(`${deviceName}: What counts? shows the Set err and Dig err definitions`,
      defs.includes("Set err: a set that loses the rally (called double or lift, or a set nobody can play).") &&
        defs.includes("Dig err: a dig that loses the rally.") &&
        defs.includes("A bad set or dig that a teammate saves is not an error."), defs);
    await c.select(2, "off"); // put them down again

    // --- an error, then undo ------------------------------------------------
    const s0 = await c.board();
    check(`${deviceName}: we start 0-0, serving`, s0.score === "0-0" && s0.serving.includes("Us"), c.show(s0));
    await c.record(1, "A_ERR");
    const afterAttack = await c.board();
    check(`${deviceName}: Attack err gives them the point and the serve`, afterAttack.score === "0-1" && afterAttack.serving.includes("Them") && afterAttack.rotation === s0.rotation, c.show(afterAttack));
    let toast = await c.undo();
    const u1 = await c.board();
    check(`${deviceName}: undo puts score, serve, rotation and court back exactly`, c.same(u1, s0), `${c.show(u1)} vs ${c.show(s0)}`);
    check(`${deviceName}: and says so: "Undone: Attack err, P1. Score 0-0."`, toast === "Undone: Attack err, P1. Score 0-0.", toast);
    check(`${deviceName}: and the stat is gone`, (await stat("attackErrors")) === 0);

    // --- Set err and Dig err do exactly what Attack err does ---------------
    for (const [jersey, action, field, name] of [[5, "SET_ERR", "settingErrors", "Set err"], [6, "DIG_ERR", "digErrors", "Dig err"]] as const) {
      await c.record(jersey, action);
      const after = await c.board();
      check(`${deviceName}: ${name} gives them the point and the serve, like Attack err`, after.score === afterAttack.score && after.serving === afterAttack.serving && after.rotation === afterAttack.rotation && after.court === afterAttack.court, c.show(after));
      check(`${deviceName}: ${name} is still recorded as a ${name}`, (await stat(field)) === 1);
      toast = await c.undo();
      check(`${deviceName}: undoing ${name} puts everything back`, c.same(await c.board(), s0) && (await stat(field)) === 0, `${c.show(await c.board())} | ${toast}`);
    }

    // --- a kill that won the serve back, then undo -------------------------
    await c.record(1, "A_ERR"); // they serve now
    const beforeKill = await c.board();
    await c.record(2, "KILL");
    const afterKill = await c.board();
    check(`${deviceName}: the kill is a side-out: point, serve, and a rotation`, afterKill.score === "1-1" && afterKill.serving.includes("Us") && afterKill.rotation !== beforeKill.rotation && afterKill.court !== beforeKill.court, c.show(afterKill));
    toast = await c.undo();
    const u2 = await c.board();
    check(`${deviceName}: undoing the kill takes the point back, returns the serve and rotates back`, c.same(u2, beforeKill), `${c.show(u2)} vs ${c.show(beforeKill)}`);
    check(`${deviceName}: "Undone: Kill, P2. Score 0-1."`, toast === "Undone: Kill, P2. Score 0-1.", toast);

    // --- a hand change between the action and the undo stays ---------------
    await c.record(2, "KILL"); // 1-1, our serve, rotated
    await c.sign("them", "plus"); // the coach adds a point by hand: 1-2
    check(`${deviceName}: a hand point after the kill makes it 1-2`, (await c.score()) === "1-2");
    await c.undo();
    const u3 = await c.board();
    check(`${deviceName}: undoing the kill takes only its point: 0-2`, u3.score === "0-2", u3.score);
    check(`${deviceName}: and still puts the serve and rotation back`, u3.serving === beforeKill.serving && u3.rotation === beforeKill.rotation && u3.court === beforeKill.court, c.show(u3));

    // --- the parent view follows ------------------------------------------
    await page.waitForTimeout(1300);
    const snap = await live(team.id, childId);
    check(`${deviceName}: parents see the corrected score`, snap.currentSet?.us === 0 && snap.currentSet?.them === 2, JSON.stringify(snap.currentSet));

    // --- several undos in a row go back one action each, in order ----------
    const states = [await c.board()];
    for (const [jersey, action] of [[2, "KILL"], [3, "KILL"], [4, "SET_ERR"], [5, "KILL"]] as const) {
      await c.record(jersey, action);
      states.push(await c.board());
    }
    check(`${deviceName}: four actions: ${states.map((x) => x.score).join(" -> ")}`, states[4].score === "3-3", states.map(c.show).join(" | "));
    let inOrder = true;
    for (let i = 3; i >= 0; i -= 1) {
      await c.undo();
      if (!c.same(await c.board(), states[i])) { inOrder = false; break; }
    }
    check(`${deviceName}: four undos in a row step back through each state exactly`, inOrder, c.show(await c.board()));

    // --- an action with no point only loses the stat ----------------------
    const beforeDig = await c.board();
    await c.record(6, "DIG");
    check(`${deviceName}: a dig moves nothing`, c.same(await c.board(), beforeDig));
    toast = await c.undo();
    check(`${deviceName}: undoing a dig removes only the stat`, c.same(await c.board(), beforeDig) && (await stat("digs")) === 0, toast);
    check(`${deviceName}: "Undone: Dig, P6."`, toast === "Undone: Dig, P6.", toast);

    // --- never below 0 ------------------------------------------------------
    // (the one A_ERR left from above is at the bottom of the undo list)
    while ((await c.score()).split("-")[1] !== "0") await c.sign("them", "minus");
    check(`${deviceName}: their score taken to 0 by hand`, (await c.score()).endsWith("-0"), await c.score());
    await c.undo(); // the old Attack err: its point is already gone
    check(`${deviceName}: undoing a point that is already gone stays at 0`, (await c.score()).endsWith("-0"), await c.score());

    // --- an action from an ended set asks first -----------------------------
    await c.record(2, "KILL"); // a point in set 1
    const set1 = await c.score();
    await c.tapEl("[data-end-set]");
    await page.waitForTimeout(400);
    await page.locator('button:has-text("End set anyway")').click();
    await page.waitForTimeout(600);
    await page.locator(modalSel).locator('button:has-text("Start set")').click({ timeout: 15000 });
    await page.waitForTimeout(600);
    const set2Start = await c.board();
    await c.tapEl("button:has([data-undo-last])", { center: false });
    await page.waitForTimeout(400);
    const ask = await page.locator("[data-confirm-undo]").innerText().catch(() => "");
    check(`${deviceName}: undoing a set 1 action from set 2 asks first`, ask.includes("was in set 1, which has") && ask.includes("ended"), ask);
    await page.locator('button:has-text("Keep it")').click();
    await page.waitForTimeout(300);
    check(`${deviceName}: Keep it changes nothing`, c.same(await c.board(), set2Start) && (await stat("kills")) === 1);
    await c.tapEl("button:has([data-undo-last])", { center: false });
    await page.waitForTimeout(400);
    await page.locator('button:has-text("Undo it")').click();
    await page.waitForTimeout(1500);
    const row = await prisma.matchSetScore.findUnique({ where: { matchId_setNumber: { matchId: match.id, setNumber: 1 } } });
    const [us1] = set1.split("-").map(Number);
    check(`${deviceName}: Undo it takes the point off set 1`, row?.us === us1 - 1, `${set1} -> ${row?.us}-${row?.them}`);
    check(`${deviceName}: and leaves set 2's score, serve and rotation alone`, c.same(await c.board(), set2Start), c.show(await c.board()));
    check(`${deviceName}: and removes the stat`, (await stat("kills")) === 0);

    const setTab = (n: number) => c.tapEl(`button:text-is("Set ${n}")`);
    const serverSet = async (n: number) => {
      const r = await prisma.matchSetScore.findUnique({ where: { matchId_setNumber: { matchId: match.id, setNumber: n } } });
      return r ? `${r.us}-${r.them}` : "none";
    };

    // --- undo while another set's tab is on screen still reaches the server
    await c.record(2, "KILL"); // set 2: 1-0
    await page.waitForTimeout(1200);
    await setTab(1);
    await c.undo();
    await page.waitForTimeout(1500);
    check(`${deviceName}: undo from the set 1 tab needs no question for a set 2 action`, (await page.locator("[data-confirm-undo]").count()) === 0);
    check(`${deviceName}: and set 2's corrected score still reaches the server`, (await serverSet(2)) === "0-0", await serverSet(2));

    // --- an action recorded on an earlier set's tab: undo puts its serve back
    const set1Before = await serverSet(1);
    const servingBefore = (await c.board()).serving;
    await c.record(1, "A_ERR"); // scored into set 1, but it moves the serve of the set in play
    const servingAfter = (await c.board()).serving;
    await c.tapEl("button:has([data-undo-last])", { center: false });
    await page.waitForTimeout(400);
    const ask2 = await page.locator("[data-confirm-undo]").innerText().catch(() => "");
    check(`${deviceName}: it asks, and says the serve goes back too`, ask2.includes("was in set 1") && ask2.includes("The serve and rotation it changed go back too."), ask2);
    await page.locator('button:has-text("Undo it")').click();
    await page.waitForTimeout(1500);
    check(`${deviceName}: the serve it changed is back`, servingAfter !== servingBefore && (await c.board()).serving === servingBefore, `${servingBefore} -> ${servingAfter} -> ${(await c.board()).serving}`);
    check(`${deviceName}: and set 1 on the server is as before`, (await serverSet(1)) === set1Before, `${set1Before} vs ${await serverSet(1)}`);
    await setTab(2);

    // --- Opp error is on the undo list, so undo stays in order ---------------
    const beforeOpp = await c.board();
    await c.record(1, "A_ERR"); // they get the point and the serve
    const afterErr = await c.board();
    await c.tapEl('button:has-text("Opp error")');
    await page.waitForTimeout(700);
    const afterOpp = await c.board();
    check(`${deviceName}: Opp error gives us the point back with a side-out`, afterOpp.rotation !== afterErr.rotation && afterOpp.serving.includes("Us"), c.show(afterOpp));
    toast = await c.undo();
    check(`${deviceName}: undo takes back the Opp error first: "Undone: Opp error. Score ${afterErr.score}."`, c.same(await c.board(), afterErr) && toast === `Undone: Opp error. Score ${afterErr.score}.`, `${c.show(await c.board())} | ${toast}`);
    await c.undo();
    check(`${deviceName}: then the Attack err, with the rotation right`, c.same(await c.board(), beforeOpp), `${c.show(await c.board())} vs ${c.show(beforeOpp)}`);
    await page.waitForTimeout(800);
    check(`${deviceName}: and the opponent error count is back to 0`, (await prisma.match.findUnique({ where: { id: match.id } }))?.opponentErrors === 0);

    // --- offline: a stat that never reached the server is simply dropped ------
    const beforeOffline = await c.board();
    await ctx.setOffline(true);
    await c.record(5, "SET_ERR");
    await c.undo();
    check(`${deviceName}: offline, undo still puts the board back`, c.same(await c.board(), beforeOffline), c.show(await c.board()));
    await ctx.setOffline(false);
    await page.waitForTimeout(3000);
    check(`${deviceName}: and back online the Set err never lands on the server`, (await stat("settingErrors")) === 0, String(await stat("settingErrors")));

    // --- a finished match: undo asks, and only the stat comes off -----------
    await c.record(2, "KILL"); // set 2: 1-0
    await page.waitForTimeout(1200);
    await c.tapEl('header button:has-text("End match")');
    await page.waitForTimeout(500);
    if (await page.locator('button:has-text("End match anyway")').count()) await page.locator('button:has-text("End match anyway")').click();
    await page.waitForURL(/\/review/, { timeout: 30000 }).catch(() => undefined);
    const set2Final = await serverSet(2);
    await page.goto(`${BASE}/match/${match.id}/entry`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await c.tapEl("button:has([data-undo-last])", { center: false });
    await page.waitForTimeout(400);
    const ask3 = await page.locator("[data-confirm-undo]").innerText().catch(() => "");
    check(`${deviceName}: in a finished match undo asks first`, ask3.includes("from a match that has ended") && ask3.includes("the final score stays as recorded"), ask3);
    await page.locator('button:has-text("Undo it")').click();
    await page.waitForTimeout(250);
    toast = await page.locator("text=/^Undone:/").last().innerText().catch(() => "");
    await page.waitForTimeout(1500);
    check(`${deviceName}: and says the final score stays`, toast === "Undone: Kill, P2. The final score stays as recorded.", toast);
    check(`${deviceName}: the stat comes off`, (await stat("kills")) === 0);
    check(`${deviceName}: and the recorded score does not change`, (await serverSet(2)) === set2Final, `${set2Final} vs ${await serverSet(2)}`);
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
