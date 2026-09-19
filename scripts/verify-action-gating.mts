// Only enable the actions the tapped player could actually have performed.
//
// Gated on what the app knows for certain: who is in which slot, who the
// libero is, which team is serving. Never on rally phase, which it cannot know.
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

function ctx(slot: number | null, serving: "us" | "them", isLibero = false): CourtContext {
  return { slot, serving, isLibero };
}
const can = (id: StatActionId, c: CourtContext) => actionAvailability(id, c).available;

// --------------------------------------------------------------- the rules
function unit() {
  console.log("\n1. The rules");
  check("slot 2, 3 and 4 are front row", isFrontRow(2) && isFrontRow(3) && isFrontRow(4));
  check("slot 1, 5 and 6 are not", !isFrontRow(1) && !isFrontRow(5) && !isFrontRow(6));

  console.log("\n   serving");
  check("slot 1 while we serve can ace", SERVE.every((a) => can(a, ctx(1, "us"))));
  for (const s of [2, 3, 4, 5, 6]) {
    check(`slot ${s} cannot serve`, SERVE.every((a) => !can(a, ctx(s, "us"))));
  }
  check("nobody serves while the other team is serving", [1, 2, 3, 4, 5, 6].every((s) => SERVE.every((a) => !can(a, ctx(s, "them")))));

  console.log("\n   serve receive");
  check("appears while the opponent serves", [1, 2, 3, 4, 5, 6].every((s) => SR.every((a) => can(a, ctx(s, "them")))));
  check("does not while we serve", [1, 2, 3, 4, 5, 6].every((s) => SR.every((a) => !can(a, ctx(s, "us")))));
  check("a middle or setter still gets it", SR.every((a) => can(a, ctx(3, "them"))));

  console.log("\n   blocking");
  for (const s of [2, 3, 4]) check(`slot ${s} can block`, BLOCKING.every((a) => can(a, ctx(s, "us"))));
  for (const s of [1, 5, 6]) check(`slot ${s} cannot block`, BLOCKING.every((a) => !can(a, ctx(s, "us"))));
  check("a libero cannot block in any slot", [1, 2, 3, 4, 5, 6].every((s) => BLOCKING.every((a) => !can(a, ctx(s, "us", true)))));

  console.log("\n   what is always enabled");
  check("every slot keeps attack", [1, 2, 3, 4, 5, 6].every((s) => ATTACK.every((a) => can(a, ctx(s, "us")))));
  check("a libero keeps attack", ATTACK.every((a) => can(a, ctx(5, "us", true))));
  check("every slot keeps dig, assist and the handling errors", [1, 2, 3, 4, 5, 6].every((s) => ALWAYS.every((a) => can(a, ctx(s, "us")))));
  check("an unknown slot gates nothing", [...SERVE, ...BLOCKING, ...ATTACK].every((a) => can(a, ctx(null, "us"))));
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

    // --- we are serving --------------------------------------------------
    await tapSlot(page, 1);
    check(`${label}: the slot 1 player on the serving team has Ace ENABLED`, (await stateOf(page, "ACE")) === "enabled", await stateOf(page, "ACE"));
    check(`${label}: and Serve err enabled`, (await stateOf(page, "S_ERR")) === "enabled");
    check(`${label}: serve receive is disabled while we serve`, await allAre(page, SR, "disabled"));
    for (const n of [2, 3, 4, 5, 6]) {
      await tapSlot(page, n);
      check(`${label}: slot ${n} has the serve actions disabled`, await allAre(page, SERVE, "disabled"));
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

    // --- the other team serving -------------------------------------------
    await page.locator('button[aria-label^="Serving"]').first().click();
    await page.waitForTimeout(600);
    await tapSlot(page, 1);
    check(`${label}: serve receive is enabled when they serve`, await allAre(page, SR, "enabled"));
    check(`${label}: and the serve actions are disabled for everyone`, await allAre(page, SERVE, "disabled"));
    check(`${label}: there is a way to correct the court`, (await page.locator('button:has-text("Fix the lineup")').count()) > 0);

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
