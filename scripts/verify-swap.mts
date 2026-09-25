// Swapping two players who are already on court.
//
// A swap is a CORRECTION, not a substitution. Nobody enters or leaves the
// match, so it must move players and nothing else: not the rotation number,
// not the serving flag, not the score. But it does change who is standing in
// which slot, so the action pad has to follow immediately - the player who
// lands in slot 1 gets Ace, and the one who leaves it loses it.
//
// Driven on emulated iPhone and Android, not a mouse, because HTML5 drag and
// drop does not fire on touch at all and this is a phone-first page.
//
// Needs a running server and Playwright's chromium:
//   npm run build && npx next start -p 3218
//   BASE=http://127.0.0.1:3218 node --env-file=.env --import tsx scripts/verify-swap.mts

import bcrypt from "bcryptjs";
import { chromium, devices, type Browser, type Page } from "playwright";
import { prisma } from "@/lib/prisma";

const BASE = process.env.BASE ?? "http://127.0.0.1:3218";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); }
  else { failed += 1; console.error(`  ✗ ${name}${detail ? `  (${detail})` : ""}`); }
}

const run = Date.now().toString(36);
const modalSel = 'div.fixed.inset-0.z-\\[100\\]';
const COURT = "div.h-52 button, div.sm\\:h-60 button";

// Who is standing in each slot, read off the court itself.
async function slotOrder(page: Page): Promise<string[]> {
  return page.$$eval("[data-court-slot]", (slots) => {
    const out: { pos: number; label: string }[] = [];
    for (const s of slots) {
      const card = s.querySelector("[data-court-card]");
      const num = s.querySelector("span.stat-number");
      if (!card || !num) continue;
      out.push({ pos: Number(num.textContent), label: (card.textContent ?? "").match(/#\d+/)?.[0] ?? "?" });
    }
    return out.sort((a, b) => a.pos - b.pos).map((o) => o.label);
  });
}

async function scoreboard(page: Page) {
  const serving = (await page.locator('button[aria-label^="Serving"]').first().getAttribute("aria-label")) ?? "?";
  const rotation = (await page.locator("text=/^R[1-6]$/").first().innerText().catch(() => "?")) ?? "?";
  const us = await page.locator('[data-score="us"]').first().innerText();
  const them = await page.locator('[data-score="them"]').first().innerText();
  return { serving, rotation, us, them };
}

async function tapCourt(page: Page, jersey: number) {
  await page.locator(COURT).filter({ hasText: `#${jersey}` }).first().tap();
  await page.waitForTimeout(400);
}

async function aceStateFor(page: Page, jersey: number) {
  // Select the player for stat entry, then read whether Ace is live.
  for (let i = 0; i < 3; i += 1) {
    await tapCourt(page, jersey);
    if ((await page.locator("[data-action]").count()) > 0) break;
  }
  const el = page.locator('[data-action="ACE"]');
  if ((await el.count()) === 0) return "absent";
  return (await el.first().getAttribute("data-disabled")) === "1" ? "disabled" : "enabled";
}

// A real long press and drag, in pointer events, the way a finger does it.
async function dragCard(page: Page, fromJersey: number, to: { jersey?: number; outside?: boolean; bench?: boolean }) {
  const from = page.locator(COURT).filter({ hasText: `#${fromJersey}` }).first();
  const a = await from.boundingBox();
  if (!a) throw new Error("no source card");
  let target: { x: number; y: number };
  if (to.jersey !== undefined) {
    const b = await page.locator(COURT).filter({ hasText: `#${to.jersey}` }).first().boundingBox();
    if (!b) throw new Error("no target card");
    target = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  } else if (to.bench) {
    const b = await page.locator("[data-bench-tile]").first().boundingBox();
    if (!b) throw new Error("no bench tile");
    target = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  } else {
    // Somewhere on the page that is neither court nor bench.
    target = { x: 5, y: 5 };
  }
  const sx = a.x + a.width / 2;
  const sy = a.y + a.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.waitForTimeout(500); // longer than the 350ms pick-up
  // Move in steps so pointermove fires and the drop target highlights.
  await page.mouse.move(sx + (target.x - sx) / 2, sy + (target.y - sy) / 2, { steps: 6 });
  await page.waitForTimeout(120);
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.waitForTimeout(160);
  await page.mouse.up();
  await page.waitForTimeout(700);
}

async function setUpMatch(label: string) {
  const passwordHash = await bcrypt.hash("test1234", 10);
  const coach = await prisma.user.create({
    // Lowercase: the app normalises emails on both register and login,
    // and this fixture bypasses the register route.
    data: { email: `swap-${label}-${run}@swap-test.local`.toLowerCase(), name: "Coach", passwordHash, role: "COACH", plan: "COACH_PRO" },
  });
  const team = await prisma.team.create({
    data: { name: `Swap ${label}`, ageGroup: "16U", coachId: coach.id, usesPositions: true },
  });
  const spec: [number, string][] = [
    [1, "OH"], [2, "OH"], [3, "MB"], [4, "MB"], [5, "S"], [6, "RS"], [7, "L"], [8, "DS"],
  ];
  for (const [n, pos] of spec) {
    await prisma.player.create({ data: { teamId: team.id, name: `P${n}`, number: n, primaryPosition: pos as never } });
  }
  const t = await prisma.tournament.create({ data: { teamId: team.id, name: "Cup", startDate: new Date() } });
  const m = await prisma.match.create({ data: { tournamentId: t.id, opponent: "Rivals", matchNumber: 1 } });
  return { coach, team, match: m };
}

async function openEntry(page: Page, email: string, matchId: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", "test1234");
  await page.click('button[type="submit"]');
  // Poll the URL rather than waitForURL: on an emulated device the load event
  // never settles, because the Vercel analytics scripts 404 against a local
  // server, and waitForURL waits on it.
  for (let i = 0; i < 60 && !page.url().includes("/dashboard"); i += 1) {
    await page.waitForTimeout(500);
  }
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

// --------------------------------------------------------------- tap to swap
async function tapSuite(browser: Browser, deviceName: string) {
  const label = deviceName;
  console.log(`\nTap to swap - ${label}`);
  const { coach, match } = await setUpMatch(`tap-${deviceName.toLowerCase().replace(/\W/g, "")}`);
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const page = await ctx.newPage();
  try {
    await openEntry(page, coach.email, match.id);
    check(`${label}: six players on court`, (await page.locator(COURT).count()) === 6);

    const before = await slotOrder(page);
    const boardBefore = await scoreboard(page);
    check(`${label}: slot 1 is #1 to start`, before[0] === "#1", before.join(" "));

    // The pad follows slot 1 before the swap.
    check(`${label}: #1 has Ace enabled before the swap`, (await aceStateFor(page, 1)) === "enabled");
    check(`${label}: #5 has Ace disabled before the swap`, (await aceStateFor(page, 5)) === "disabled");

    // Arm, then two taps.
    await page.locator("[data-swap-toggle]").tap();
    await page.waitForTimeout(300);
    check(`${label}: swap mode says what it wants`, (await page.locator("[data-swap-note]").innerText()).toLowerCase().includes("tap two players"));
    await tapCourt(page, 1);
    check(`${label}: the first player is picked up`, (await page.locator('[data-picked="1"]').count()) === 1);
    check(`${label}: and the note says what happens next`, (await page.locator("[data-swap-note]").innerText()).includes("picked up"));

    // Tapping the same player again puts them back down.
    await tapCourt(page, 1);
    check(`${label}: tapping them again puts them down`, (await page.locator('[data-picked="1"]').count()) === 0);
    check(`${label}: and nobody moved`, (await slotOrder(page)).join() === before.join());

    // Now a real swap.
    await tapCourt(page, 1);
    await tapCourt(page, 5);
    const after = await slotOrder(page);
    check(`${label}: the two players changed places`, after[0] === before[4] && after[4] === before[0], `${before.join(" ")} -> ${after.join(" ")}`);
    check(`${label}: nobody else moved`, after.filter((v, i) => v !== before[i]).length === 2, after.join(" "));
    check(`${label}: swap mode disarms itself`, (await page.locator('[data-swap-toggle][aria-pressed="true"]').count()) === 0);

    // --- a swap moves players and nothing else -------------------------
    const boardAfter = await scoreboard(page);
    check(`${label}: the rotation number did not change`, boardAfter.rotation === boardBefore.rotation, `${boardBefore.rotation} -> ${boardAfter.rotation}`);
    check(`${label}: the serving flag did not change`, boardAfter.serving === boardBefore.serving, `${boardBefore.serving} -> ${boardAfter.serving}`);
    check(`${label}: the score did not change`, boardAfter.us === boardBefore.us && boardAfter.them === boardBefore.them);
    // Setting a lineup already writes a positionPlayed row per starter, so the
    // question is whether the SWAP wrote anything, not whether the table is
    // empty. Nothing about a swap should touch a stat line at all.
    const linesAfter = await prisma.statLine.aggregate({
      where: { matchId: match.id },
      _sum: { kills: true, aces: true, digs: true, blocks: true, assists: true },
    });
    const totals = Object.values(linesAfter._sum).reduce<number>((n, v) => n + (v ?? 0), 0);
    check(`${label}: the swap recorded no stat`, totals === 0, String(totals));

    // --- but the action pad follows the new slots, both ways -------------
    check(`${label}: the player now in slot 1 has Ace ENABLED`, (await aceStateFor(page, 5)) === "enabled");
    check(`${label}: the player who left slot 1 has Ace DISABLED`, (await aceStateFor(page, 1)) === "disabled");

    // --- undo: the same pair again puts them back exactly ---------------
    await page.locator("[data-swap-toggle]").tap();
    await page.waitForTimeout(300);
    await tapCourt(page, 1);
    await tapCourt(page, 5);
    const undone = await slotOrder(page);
    check(`${label}: swapping the same pair again restores the order exactly`, undone.join() === before.join(), `${undone.join(" ")} vs ${before.join(" ")}`);
    check(`${label}: and Ace is back with the original slot 1`, (await aceStateFor(page, 1)) === "enabled");

    // --- a bench tap in swap mode is refused, with a reason --------------
    await page.locator("[data-swap-toggle]").tap();
    await page.waitForTimeout(300);
    const orderBeforeBench = await slotOrder(page);
    await page.locator("[data-bench-tile]").first().locator("button").first().tap();
    await page.waitForTimeout(500);
    const note = await page.locator("[data-swap-note]").innerText();
    check(`${label}: a bench tap during a swap is refused`, note.toLowerCase().includes("bench"), note);
    check(`${label}: it explains that swapping is court-only`, note.toLowerCase().includes("already on court"), note);
    check(`${label}: the sub modal did not open`, (await page.locator(modalSel).count()) === 0);
    check(`${label}: and nothing moved`, (await slotOrder(page)).join() === orderBeforeBench.join());

    // --- the libero flow still works ------------------------------------
    await page.locator('button:has-text("Cancel swap")').tap();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Libero")').first().tap();
    await page.waitForTimeout(700);
    // Both L and DS count as liberos, so this roster has two and the picker
    // asks which one before asking who they replace.
    const whichLibero = page.locator(modalSel).locator("button").filter({ hasText: "P7" }).first();
    if (await whichLibero.count()) {
      await whichLibero.click();
      await page.waitForTimeout(600);
    }
    const pick = page.locator(modalSel).locator("button").filter({ hasText: "P2" }).first();
    if (await pick.count()) {
      await pick.click();
      await page.waitForTimeout(1400);
    }
    const withLibero = await slotOrder(page);
    check(`${label}: the libero came on`, withLibero.includes("#7"), withLibero.join(" "));
    check(`${label}: and the libero out button is offered`, (await page.locator('button:has-text("Libero out")').count()) === 1);

    // A swap while the libero is on, then send the libero out: the player
    // they replaced must still come back, wherever the libero is standing.
    await page.locator("[data-swap-toggle]").tap();
    await page.waitForTimeout(300);
    await tapCourt(page, 7);
    await tapCourt(page, 3);
    await page.waitForTimeout(500);
    check(`${label}: the libero can be moved by a swap`, (await slotOrder(page)).join() !== withLibero.join());
    await page.locator('button:has-text("Libero out")').tap();
    await page.waitForTimeout(1000);
    const liberoOut = await slotOrder(page);
    check(`${label}: libero out still restores the player they replaced`, liberoOut.includes("#2") && !liberoOut.includes("#7"), liberoOut.join(" "));
  } finally {
    await ctx.close();
    await prisma.user.deleteMany({ where: { id: coach.id } });
  }
}

// ------------------------------------------------------------ drag to swap
async function dragSuite(browser: Browser) {
  console.log("\nDrag to swap - desktop pointer");
  const { coach, match } = await setUpMatch("drag");
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1200 }, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await openEntry(page, coach.email, match.id);
    const before = await slotOrder(page);
    const boardBefore = await scoreboard(page);

    // A long press and drop onto another court player swaps them, with no
    // swap mode armed: a long press is already unambiguous.
    await dragCard(page, 1, { jersey: 5 });
    const after = await slotOrder(page);
    check("drag: dropping on another player swaps them", after[0] === before[4] && after[4] === before[0], `${before.join(" ")} -> ${after.join(" ")}`);
    check("drag: nobody else moved", after.filter((v, i) => v !== before[i]).length === 2);
    const boardAfter = await scoreboard(page);
    check("drag: rotation, serve and score unchanged", boardAfter.rotation === boardBefore.rotation && boardAfter.serving === boardBefore.serving && boardAfter.us === boardBefore.us && boardAfter.them === boardBefore.them);
    check("drag: the pad follows - the new slot 1 has Ace enabled", (await aceStateFor(page, 5)) === "enabled");

    // Dropping outside the court cancels, and says so.
    const beforeOutside = await slotOrder(page);
    await dragCard(page, 5, { outside: true });
    check("drag: dropping outside the court moves nobody", (await slotOrder(page)).join() === beforeOutside.join());
    const outsideNote = await page.locator("[data-swap-note]").innerText().catch(() => "");
    check("drag: and it says why", outsideNote.toLowerCase().includes("outside the court"), outsideNote);

    // Dropping on the bench is refused with a reason, never treated as a sub.
    const beforeBench = await slotOrder(page);
    await dragCard(page, 5, { bench: true });
    check("drag: dropping on the bench moves nobody", (await slotOrder(page)).join() === beforeBench.join());
    const benchNote = await page.locator("[data-swap-note]").innerText().catch(() => "");
    check("drag: and it explains that this is not a substitution", benchNote.toLowerCase().includes("does not substitute"), benchNote);
    check("drag: the sub modal did not open", (await page.locator(modalSel).count()) === 0);
    // As above: the lineup itself wrote a row per starter. What matters is
    // that no drag, refused or not, recorded a stat.
    const dragTotals = await prisma.statLine.aggregate({
      where: { matchId: match.id },
      _sum: { kills: true, aces: true, digs: true, blocks: true, assists: true },
    });
    const wrote = Object.values(dragTotals._sum).reduce<number>((n, v) => n + (v ?? 0), 0);
    check("drag: no drag recorded a stat", wrote === 0, String(wrote));

    // A short tap must still select for stats, not start a drag. #1 rather
    // than #5, because #5 is already selected and a second tap would just
    // put them down again.
    await tapCourt(page, 1);
    check("drag: a short tap still selects a player for stat entry", (await page.locator("[data-action]").count()) > 0);
  } finally {
    await ctx.close();
    await prisma.user.deleteMany({ where: { id: coach.id } });
  }
}

// ------------------------------------------------- drag, with a real finger
// The mouse drag above proves the logic. This proves the gesture survives on
// touch, which is the whole reason for pointer events: HTML5 drag and drop
// fires nothing at all on a phone. Real touch events via CDP, not synthesised
// ones, so the browser produces the same pointer events a finger would.
async function touchDragSuite(browser: Browser, deviceName: string) {
  console.log(`\nDrag to swap - ${deviceName} touch`);
  const { coach, match } = await setUpMatch(`touchdrag-${deviceName.toLowerCase().replace(/\W/g, "")}`);
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const page = await ctx.newPage();
  try {
    await openEntry(page, coach.email, match.id);
    const cdp = await ctx.newCDPSession(page);
    // CDP touch coordinates are viewport-relative and, unlike locator.tap(),
    // nothing scrolls the target into view first. On a phone viewport the
    // court starts below the fold, so aiming at an unscrolled box lands on
    // nothing at all.
    const centre = async (jersey: number) => {
      const card = page.locator(COURT).filter({ hasText: `#${jersey}` }).first();
      // block:"center", not scrollIntoViewIfNeeded: the app has a fixed bottom
      // nav on phone widths, and "just barely in view" puts the court under it.
      await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(300);
      const box = await card.boundingBox();
      if (!box) throw new Error(`no card #${jersey}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    // Where a card is right now, without scrolling: for the second end of a
    // drag, whose start was just centred (centring it too would scroll the
    // page and leave the first point aimed at the wrong card).
    const at = async (jersey: number) => {
      const box = await page.locator(COURT).filter({ hasText: `#${jersey}` }).first().boundingBox();
      if (!box) throw new Error(`no card #${jersey}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const touch = (type: string, pts: { x: number; y: number }[]) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: pts.map((p) => ({ x: p.x, y: p.y, radiusX: 12, radiusY: 12, force: 1 })),
      } as never);

    // --- a swipe on the court scrolls; only a picked-up player holds it ---
    // The court was touch-action:none, so a thumb that landed on a player
    // could not scroll the page at all. A swipe must scroll, in both
    // directions, without picking anyone up or selecting them.
    const scrollY = () => page.evaluate(() => window.scrollY);
    const swipe = async (from: { x: number; y: number }, dy: number) => {
      await touch("touchStart", [from]);
      for (let i = 1; i <= 8; i += 1) {
        await touch("touchMove", [{ x: from.x, y: from.y + (dy * i) / 8 }]);
        await page.waitForTimeout(16);
      }
      await touch("touchEnd", []);
      await page.waitForTimeout(700);
    };
    const s = await centre(3);
    const y0 = await scrollY();
    await swipe(s, -160); // finger moves up, page scrolls down
    const y1 = await scrollY();
    check(`${deviceName} touch: a swipe that starts on a court player scrolls the page down`, y1 > y0 + 40, `${y0} -> ${y1}`);
    const s2 = await centre(3);
    const y2 = await scrollY();
    await swipe(s2, 160); // finger moves down, page scrolls up
    const y3 = await scrollY();
    check(`${deviceName} touch: and scrolls it back up`, y3 < y2 - 40, `${y2} -> ${y3}`);
    check(`${deviceName} touch: a swipe picks nobody up`, (await page.locator('[data-picked="1"]').count()) === 0);
    check(`${deviceName} touch: and selects nobody for a stat`, (await page.locator("[data-action]").count()) === 0);

    // A quick tap, as a real touch, still opens the stat pad.
    const t = await centre(4);
    await touch("touchStart", [t]);
    await page.waitForTimeout(60);
    await touch("touchEnd", []);
    await page.waitForTimeout(500);
    check(`${deviceName} touch: a tap on a court player opens the stat pad`, (await page.locator("[data-action]").count()) > 0);
    check(`${deviceName} touch: a tap picks nobody up`, (await page.locator('[data-picked="1"]').count()) === 0);
    // Tap the same player again to put them down before the drags below.
    await touch("touchStart", [await centre(4)]);
    await page.waitForTimeout(60);
    await touch("touchEnd", []);
    await page.waitForTimeout(500);

    // A long press that has picked a player up holds the page still while
    // the finger moves up the court, and the drop still swaps.
    const orderV = await slotOrder(page);
    const v1 = await centre(1); // back row, right
    const v2 = await at(2); // front row, right: straight up from #1
    const yBeforeLift = await scrollY();
    await touch("touchStart", [v1]);
    await page.waitForTimeout(550); // hold past the 350ms pick-up
    let drift = 0;
    for (let i = 1; i <= 8; i += 1) {
      await touch("touchMove", [{ x: v1.x, y: v1.y + ((v2.y - v1.y) * i) / 8 }]);
      await page.waitForTimeout(40);
      drift = Math.max(drift, Math.abs((await scrollY()) - yBeforeLift));
    }
    check(`${deviceName} touch: a picked-up player does not scroll the page while dragged`, drift === 0, `moved ${drift}px`);
    check(`${deviceName} touch: and stays picked up the whole way`, (await page.locator('[data-picked="1"]').count()) === 1);
    await touch("touchEnd", []);
    await page.waitForTimeout(800);
    const afterV = await slotOrder(page);
    check(`${deviceName} touch: a vertical drag swaps them`, afterV[0] === orderV[1] && afterV[1] === orderV[0], `${orderV.join(" ")} -> ${afterV.join(" ")}`);
    // And back, so the checks below start from the original order.
    const w1 = await centre(Number(orderV[1].slice(1)));
    const w2 = await at(Number(orderV[0].slice(1)));
    await touch("touchStart", [w1]);
    await page.waitForTimeout(550);
    for (let i = 1; i <= 8; i += 1) {
      await touch("touchMove", [{ x: w1.x, y: w1.y + ((w2.y - w1.y) * i) / 8 }]);
      await page.waitForTimeout(40);
    }
    await touch("touchEnd", []);
    await page.waitForTimeout(800);
    check(`${deviceName} touch: and dragging back restores them`, (await slotOrder(page)).join() === orderV.join(), (await slotOrder(page)).join(" "));

    const before = await slotOrder(page);
    const boardBefore = await scoreboard(page);
    const a = await centre(1);
    const b = await centre(5);

    await touch("touchStart", [a]);
    await page.waitForTimeout(550); // hold past the 350ms pick-up
    for (let i = 1; i <= 6; i += 1) {
      await touch("touchMove", [{ x: a.x + ((b.x - a.x) * i) / 6, y: a.y + ((b.y - a.y) * i) / 6 }]);
      await page.waitForTimeout(60);
    }
    check(`${deviceName} touch: the card is picked up by a long press`, (await page.locator('[data-picked="1"]').count()) === 1);
    check(`${deviceName} touch: and a valid target is highlighted`, (await page.locator('[data-target="1"]').count()) >= 1);
    await touch("touchEnd", []);
    await page.waitForTimeout(800);

    const after = await slotOrder(page);
    check(`${deviceName} touch: dropping on another player swaps them`, after[0] === before[4] && after[4] === before[0], `${before.join(" ")} -> ${after.join(" ")}`);
    const boardAfter = await scoreboard(page);
    check(`${deviceName} touch: rotation, serve and score unchanged`, boardAfter.rotation === boardBefore.rotation && boardAfter.serving === boardBefore.serving && boardAfter.us === boardBefore.us && boardAfter.them === boardBefore.them);
    check(`${deviceName} touch: the pad follows the new slot 1`, (await aceStateFor(page, 5)) === "enabled");

    // Dragging the same pair back restores it exactly, by finger too.
    const a2 = await centre(5);
    const b2 = await centre(1);
    await touch("touchStart", [a2]);
    await page.waitForTimeout(550);
    for (let i = 1; i <= 6; i += 1) {
      await touch("touchMove", [{ x: a2.x + ((b2.x - a2.x) * i) / 6, y: a2.y + ((b2.y - a2.y) * i) / 6 }]);
      await page.waitForTimeout(60);
    }
    await touch("touchEnd", []);
    await page.waitForTimeout(800);
    check(`${deviceName} touch: dragging them back restores the order exactly`, (await slotOrder(page)).join() === before.join(), (await slotOrder(page)).join(" "));
  } finally {
    await ctx.close();
    await prisma.user.deleteMany({ where: { id: coach.id } });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await tapSuite(browser, "iPhone 13");
    await tapSuite(browser, "Pixel 5");
    await dragSuite(browser);
    await touchDragSuite(browser, "iPhone 13");
    await touchDragSuite(browser, "Pixel 5");
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
