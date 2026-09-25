// Only enable the actions the tapped player could actually have performed.
//
// Two rules decide what is gated:
//   1. Gate only on what the app knows for certain. That is the lineup - who
//      is in which slot, and who the libero is.
//   2. Never gate on a state the action itself is used to correct. That rules
//      out the serving flag entirely, because an ace, a serve error and a pass
//      are all proof of who served, and the app uses them to repair it.
//
// Nothing is ever removed from the pad. An action a player cannot perform is
// present and disabled, so "absent" is a failure here, not a pass. A button
// that disappears takes its own explanation with it.
//
// Needs a running server and Playwright's chromium:
//   npm run build && npx next start -p 3218
//   BASE=http://127.0.0.1:3218 node --env-file=.env --import tsx scripts/verify-action-gating.mts

import bcrypt from "bcryptjs";
import { chromium, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { actionAvailability, isFrontRow, type CourtContext } from "@/lib/action-availability";
import { servingAssertionFor } from "@/lib/rotation";
import type { StatActionId } from "@/lib/stat-actions";

const BASE = process.env.BASE ?? "http://127.0.0.1:3218";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); }
  else { failed += 1; console.error(`  ✗ ${name}${detail ? `  (${detail})` : ""}`); }
}

const run = Date.now().toString(36);
const email = (who: string) => `${who}-${run}@gating-test.local`;

const SERVE: StatActionId[] = ["ACE", "S_ERR"];
const BLOCKING: StatActionId[] = ["BLOCK", "NET_ERR"];
const SR: StatActionId[] = ["SR_0", "SR_1", "SR_2", "SR_3"];
const ATTACK: StatActionId[] = ["KILL", "A_ERR"];
const ALWAYS: StatActionId[] = ["DIG", "ASSIST", "SET_ERR", "DIG_ERR", "GEN_ERR"];
const ALL: StatActionId[] = [...ATTACK, ...SERVE, ...BLOCKING, ...SR, ...ALWAYS];

const ctx = (slot: number | null, isLibero = false): CourtContext => ({ slot, isLibero });
const can = (id: StatActionId, c: CourtContext) => actionAvailability(id, c).available;

// --------------------------------------------------------------- the rules
function unit() {
  console.log("\n1. The rules");
  check("slot 2, 3 and 4 are front row", isFrontRow(2) && isFrontRow(3) && isFrontRow(4));
  check("slot 1, 5 and 6 are not", !isFrontRow(1) && !isFrontRow(5) && !isFrontRow(6));

  console.log("\n   nothing is gated on a state its own action repairs");
  check("ACE and S_ERR assert the serving state", SERVE.every((id) => servingAssertionFor(id) === "us"));
  check("so does every serve receive grade", SR.every((id) => servingAssertionFor(id) === "them"));
  check("blocking asserts nothing, so it may stay gated on the lineup", BLOCKING.every((id) => servingAssertionFor(id) === undefined));
  // The serving flag is not in CourtContext at all, so this holds structurally
  // rather than by convention: there is no state here to gate on.
  check(
    "no asserting action is disabled anywhere its lineup rule allows it",
    ALL.filter((id) => servingAssertionFor(id)).every((id) =>
      SERVE.includes(id) ? can(id, ctx(1)) : [1, 2, 3, 4, 5, 6].every((s) => can(id, ctx(s))),
    ),
  );

  console.log("\n   serving");
  check("slot 1 can ace", SERVE.every((a) => can(a, ctx(1))));
  for (const s of [2, 3, 4, 5, 6]) {
    check(`slot ${s} cannot serve`, SERVE.every((a) => !can(a, ctx(s))));
  }

  console.log("\n   serve receive");
  check("available from every slot", [1, 2, 3, 4, 5, 6].every((s) => SR.every((a) => can(a, ctx(s)))));
  check("a middle or setter still gets it", SR.every((a) => can(a, ctx(3))));
  check("a libero gets it too", SR.every((a) => can(a, ctx(5, true))));

  console.log("\n   blocking");
  for (const s of [2, 3, 4]) check(`slot ${s} can block`, BLOCKING.every((a) => can(a, ctx(s))));
  for (const s of [1, 5, 6]) check(`slot ${s} cannot block`, BLOCKING.every((a) => !can(a, ctx(s))));
  check("a libero cannot block in any slot", [1, 2, 3, 4, 5, 6].every((s) => BLOCKING.every((a) => !can(a, ctx(s, true)))));

  console.log("\n   what is always enabled");
  check("every slot keeps attack", [1, 2, 3, 4, 5, 6].every((s) => ATTACK.every((a) => can(a, ctx(s)))));
  check("a libero keeps attack", ATTACK.every((a) => can(a, ctx(5, true))));
  check("every slot keeps dig, assist and the handling errors", [1, 2, 3, 4, 5, 6].every((s) => ALWAYS.every((a) => can(a, ctx(s)))));
  check("an unknown slot gates nothing", ALL.every((a) => can(a, ctx(null))));
}

// ------------------------------------------------------------- the browser
const COURT = "div.h-52 button, div.sm\\:h-60 button";
const modalSel = 'div.fixed.inset-0.z-\\[100\\]';

async function cellBoxes(page: Page): Promise<Record<string, number[]>> {
  return page.$$eval("[data-action]", (els) => {
    const out: Record<string, number[]> = {};
    for (const el of els) {
      const id = el.getAttribute("data-action");
      if (!id) continue;
      const r = el.getBoundingClientRect();
      out[id] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }
    return out;
  });
}

// Three states, and only one of them is acceptable for a button that should
// not be usable: present and marked disabled. "absent" is the bug.
async function stateOf(page: Page, id: StatActionId) {
  const el = page.locator(`[data-action="${id}"]`);
  if ((await el.count()) === 0) return "absent";
  return (await el.first().getAttribute("data-disabled")) === "1" ? "disabled" : "enabled";
}

async function allAre(page: Page, ids: StatActionId[], want: string) {
  for (const id of ids) if ((await stateOf(page, id)) !== want) return false;
  return true;
}

async function servingSays(page: Page) {
  return (await page.locator('button[aria-label^="Serving"]').first().getAttribute("aria-label")) ?? "?";
}

const OUR_SCORE = '[data-score="us"]';

// Tapping the already-selected player deselects them, so a repeat tap would
// leave an empty panel and make every later assertion meaningless.
async function tapSlot(page: Page, number: number) {
  const cell = page.locator(COURT).filter({ hasText: `#${number}` }).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await cell.click();
    await page.waitForTimeout(350);
    if ((await page.locator("[data-action]").count()) > 0) return;
  }
  throw new Error(`tapping #${number} never opened the action pad`);
}

async function browser(usesPositions: boolean) {
  const label = usesPositions ? "positions" : "no positions";
  console.log(`\n2. In the app, ${label} team`);
  const passwordHash = await bcrypt.hash("test1234", 10);
  const coach = await prisma.user.create({
    data: { email: email(`coach-${usesPositions}`), name: "Coach", passwordHash, role: "COACH", plan: "COACH_PRO" },
  });
  const team = await prisma.team.create({
    data: { name: `Gating ${label}`, ageGroup: usesPositions ? "16U" : "13U", coachId: coach.id, usesPositions },
  });
  // Tap order in the lineup modal decides the slots, so the libero lands in
  // slot 3, a front row slot, which is the case worth proving.
  const spec: [number, string][] = usesPositions
    ? [[1, "OH"], [2, "OH"], [3, "L"], [4, "MB"], [5, "S"], [6, "MB"], [7, "RS"], [8, "DS"]]
    : [[1, "UTIL"], [2, "UTIL"], [3, "UTIL"], [4, "UTIL"], [5, "UTIL"], [6, "UTIL"], [7, "UTIL"], [8, "UTIL"]];
  // One deliberately long name. If the panel header ever wraps to a second
  // line it pushes every button below it down, which the pixel section at the
  // end would then catch.
  const LONG = "P4 Vandersluis-Achterberg Okonkwo-Baptiste";
  for (const [n, pos] of spec) {
    await prisma.player.create({
      data: { teamId: team.id, name: n === 4 ? LONG : `P${n}`, number: n, primaryPosition: pos as never },
    });
  }
  const t = await prisma.tournament.create({ data: { teamId: team.id, name: "Cup", startDate: new Date() } });
  const m = await prisma.match.create({ data: { tournamentId: t.id, opponent: "Rivals", matchNumber: 1 } });

  const b = await chromium.launch({ headless: true });
  try {
    const page = await (await b.newContext({ viewport: { width: 1100, height: 1200 } })).newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", coach.email);
    await page.fill("#password", "test1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await page.goto(`${BASE}/match/${m.id}/entry`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Lineup in jersey order, so slot n holds #n.
    const tiles = page.locator(modalSel).locator("div.grid button");
    for (let n = 1; n <= 6; n += 1) {
      await tiles.filter({ hasText: `P${n}` }).first().click();
    }
    await page.locator(modalSel).locator('button:has-text("Start match")').click();
    await page.waitForTimeout(2000);
    const setStart = page.locator('button:has-text("Start set"), button:has-text("Confirm")');
    if (await setStart.count()) await setStart.first().click().catch(() => undefined);
    await page.waitForTimeout(1000);
    check(`${label}: six players on court`, (await page.locator(COURT).count()) === 6);

    // --- nothing is ever missing ----------------------------------------
    for (const n of [1, 2, 3, 4, 5, 6]) {
      await tapSlot(page, n);
      const missing: string[] = [];
      for (const id of ALL) if ((await stateOf(page, id)) === "absent") missing.push(id);
      check(`${label}: slot ${n} has all 15 buttons present`, missing.length === 0, missing.join(","));
    }

    // --- serving: slot 1 only, whatever the scoreboard says --------------
    await tapSlot(page, 1);
    check(`${label}: the slot 1 player has Ace enabled`, (await stateOf(page, "ACE")) === "enabled", await stateOf(page, "ACE"));
    check(`${label}: and Serve err enabled`, (await stateOf(page, "S_ERR")) === "enabled");
    check(`${label}: serve receive is enabled while we serve`, await allAre(page, SR, "enabled"));
    for (const n of [2, 3, 4, 5, 6]) {
      await tapSlot(page, n);
      check(`${label}: slot ${n} has the serve actions disabled`, await allAre(page, SERVE, "disabled"));
      check(`${label}: slot ${n} still has serve receive enabled`, await allAre(page, SR, "enabled"));
    }

    // --- blocking, and the libero ----------------------------------------
    // Slot 3 is the libero on the positions team, so it is checked on its own.
    for (const n of [2, 4]) {
      await tapSlot(page, n);
      check(`${label}: slot ${n} front row has block enabled`, await allAre(page, BLOCKING, "enabled"));
    }
    for (const n of [1, 5, 6]) {
      await tapSlot(page, n);
      check(`${label}: slot ${n} back row has block disabled`, await allAre(page, BLOCKING, "disabled"));
    }
    await tapSlot(page, 3);
    if (usesPositions) {
      check(`${label}: the libero in a front row slot still has block disabled`, await allAre(page, BLOCKING, "disabled"));
    } else {
      check(`${label}: slot 3 has block enabled, there is no libero here`, await allAre(page, BLOCKING, "enabled"));
    }

    // --- a disabled button explains itself and writes nothing -------------
    await tapSlot(page, 5);
    const before = await prisma.statLine.count({ where: { matchId: m.id } });
    // force: Playwright treats aria-disabled as unclickable, but a real tap on
    // a real phone lands - that is the whole point of the explanation line.
    await page.locator('[data-action="BLOCK"]').first().click({ force: true });
    await page.waitForTimeout(900);
    const reason = page.locator("[data-blocked-reason]");
    check(`${label}: tapping a disabled Block explains itself`, (await reason.count()) > 0 && (await reason.innerText()).toLowerCase().includes("back row"), await reason.innerText().catch(() => "no line"));
    const after = await prisma.statLine.count({ where: { matchId: m.id } });
    check(`${label}: and writes nothing to the database`, after === before, `${before} -> ${after}`);
    check(`${label}: a disabled button is out of the tab order`, (await page.locator('[data-action="BLOCK"]').first().getAttribute("tabindex")) === "-1");

    // An enabled button on the same pad still records.
    await page.locator('[data-action="KILL"]').first().click();
    await page.waitForTimeout(1500);
    const afterKill = await prisma.statLine.count({ where: { matchId: m.id, kills: { gt: 0 } } });
    check(`${label}: an enabled button on the same pad still records`, afterKill === 1, String(afterKill));

    // --- attack is never disabled -----------------------------------------
    for (const n of [1, 5, 6]) {
      await tapSlot(page, n);
      check(`${label}: slot ${n} keeps every attack button enabled`, await allAre(page, ATTACK, "enabled"));
    }

    // --- THE DEADLOCK ------------------------------------------------------
    // A stale serving flag used to disable the one button that repairs it, so
    // it stayed wrong for the rest of the set. The flag drifts for real: a
    // manual score correction deliberately does not move it.
    console.log(`\n   ${label}: a stale serving flag`);
    if ((await servingSays(page)).includes("Us")) {
      await page.locator('button[aria-label^="Serving"]').first().click();
      await page.waitForTimeout(500);
    }
    check(`${label}: the flag wrongly says the other team is serving`, (await servingSays(page)).includes("Them"), await servingSays(page));

    await tapSlot(page, 1);
    check(`${label}: the slot 1 player STILL has Ace enabled`, (await stateOf(page, "ACE")) === "enabled", await stateOf(page, "ACE"));

    const acesBefore = await prisma.statLine.count({ where: { matchId: m.id, aces: { gt: 0 } } });
    await page.locator('[data-action="ACE"]').first().click();
    await page.waitForTimeout(1800);
    const acesAfter = await prisma.statLine.count({ where: { matchId: m.id, aces: { gt: 0 } } });
    check(`${label}: the ace records`, acesAfter === acesBefore + 1, `${acesBefore} -> ${acesAfter}`);
    check(`${label}: and the flag corrects itself to Us`, (await servingSays(page)).includes("Us"), await servingSays(page));

    // The same repair in reverse: a pass proves the other team served.
    const scoreBefore = await page.locator(OUR_SCORE).first().innerText();
    await tapSlot(page, 4);
    await page.locator('[data-action="SR_2"]').first().click();
    await page.waitForTimeout(1500);
    check(`${label}: recording a pass corrects the flag back to Them`, (await servingSays(page)).includes("Them"), await servingSays(page));
    check(`${label}: and scores nothing`, (await page.locator(OUR_SCORE).first().innerText()) === scoreBefore, scoreBefore);

    // Recording a stat clears the selection, so re-select before looking at
    // the panel. The court's own "Edit lineup" is there either way.
    check(`${label}: the court always offers Edit lineup`, (await page.locator('button:has-text("Edit lineup")').count()) > 0);
    await tapSlot(page, 2);
    check(`${label}: and the pad offers Fix the lineup`, (await page.locator('button:has-text("Fix the lineup")').count()) > 0);

    // --- buttons must not move ---------------------------------------------
    const boxes: Record<string, Record<string, number[]>> = {};
    for (const n of [1, 2, 3, 4, 5, 6]) {
      await tapSlot(page, n);
      boxes[`slot${n}`] = await cellBoxes(page);
    }
    const first = boxes.slot1;
    const ids = Object.keys(first);
    // Guard the guard. A measurement that finds nothing would otherwise report
    // "nothing moved" and pass, which is how this section first went green.
    check(`${label}: all 15 actions measured`, ids.length === 15, `${ids.length} cells`);
    let moved: string | null = ids.length === 0 ? "nothing was measured" : null;
    for (const [where, map] of Object.entries(boxes)) {
      if (moved) break;
      for (const id of ids) {
        const a = first[id], c = map[id];
        if (!c) { moved = `${id} missing entirely on ${where}`; break; }
        if (a[0] !== c[0] || a[1] !== c[1] || a[2] !== c[2] || a[3] !== c[3]) {
          moved = `${id} moved on ${where}: ${a.join(",")} -> ${c.join(",")}`;
          break;
        }
      }
    }
    check(`${label}: every action is at the same pixel position for all six players`, moved === null, moved ?? "");
  } finally {
    await b.close();
    await prisma.user.deleteMany({ where: { id: coach.id } });
  }
}

async function main() {
  unit();
  await browser(true);
  await browser(false);
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
