// Only show actions the tapped player could actually have performed.
//
// Gated on what the app knows for certain: who is in which slot, who the
// libero is, which team is serving. Never on rally phase, which it cannot know.
//
// The requirement that decides whether this helps or hurts is that buttons do
// not move. Every action keeps its cell, and the last section measures that
// rather than trusting it.
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

  console.log("\n   what must never be hidden");
  check("every slot keeps attack", [1, 2, 3, 4, 5, 6].every((s) => ATTACK.every((a) => can(a, ctx(s, "us")))));
  check("a libero keeps attack", ATTACK.every((a) => can(a, ctx(5, "us", true))));
  check("every slot keeps dig, assist and the handling errors", [1, 2, 3, 4, 5, 6].every((s) => ALWAYS.every((a) => can(a, ctx(s, "us")))));
  check("an unknown slot gates nothing", [...SERVE, ...BLOCKING, ...ATTACK].every((a) => can(a, ctx(null, "us"))));
}

// ------------------------------------------------------------- the browser
const COURT = "div.h-52 button, div.sm\\:h-60 button";
const modalSel = 'div.fixed.inset-0.z-\\[100\\]';

async function cellBoxes(page: Page): Promise<Record<string, number[]>> {
  return page.$$eval("[data-action], [data-action-empty]", (els) => {
    const out: Record<string, number[]> = {};
    for (const el of els) {
      const id =
        el.getAttribute("data-action") ?? el.getAttribute("data-action-empty");
      if (!id) continue;
      const r = el.getBoundingClientRect();
      out[id] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }
    return out;
  });
}

async function present(page: Page, id: StatActionId) {
  return (await page.locator(`[data-action="${id}"]`).count()) > 0;
}

// Tapping the already-selected player deselects them, so a repeat tap would
// leave an empty panel and make every later assertion meaningless. Tap until
// the pad is actually showing.
async function tapSlot(page: Page, number: number) {
  const cell = page.locator(COURT).filter({ hasText: `#${number}` }).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await cell.click();
    await page.waitForTimeout(350);
    if ((await page.locator("[data-action], [data-action-empty]").count()) > 0) return;
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
    await page.waitForTimeout(1200);

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

    // --- we are serving -------------------------------------------------
    await tapSlot(page, 1);
    check(`${label}: slot 1 shows serve actions`, (await present(page, "ACE")) && (await present(page, "S_ERR")));
    check(`${label}: slot 1 shows no serve receive`, !(await present(page, "SR_2")));
    for (const n of [2, 3, 4, 5, 6]) {
      await tapSlot(page, n);
      check(`${label}: slot ${n} shows no serve actions`, !(await present(page, "ACE")) && !(await present(page, "S_ERR")));
    }

    // --- blocking, and the libero ---------------------------------------
    // Slot 3 is the libero on the positions team, so it is checked on its own.
    for (const n of [2, 4]) {
      await tapSlot(page, n);
      check(`${label}: slot ${n} front row shows block`, await present(page, "BLOCK"));
    }
    for (const n of [1, 5, 6]) {
      await tapSlot(page, n);
      check(`${label}: slot ${n} back row shows no block`, !(await present(page, "BLOCK")) && !(await present(page, "NET_ERR")));
    }
    await tapSlot(page, 3);
    if (usesPositions) {
      check(`${label}: the libero in a front row slot still shows no block`, !(await present(page, "BLOCK")));
      check(`${label}: and the panel says why`, (await page.locator("[data-hidden-reasons]").innerText()).toLowerCase().includes("libero"));
    } else {
      check(`${label}: slot 3 shows block, there is no libero here`, await present(page, "BLOCK"));
    }

    // --- attack is never hidden -----------------------------------------
    for (const n of [1, 5, 6]) {
      await tapSlot(page, n);
      check(`${label}: slot ${n} keeps every attack button`, (await present(page, "KILL")) && (await present(page, "A_ERR")));
    }

    // --- the other team serving -----------------------------------------
    await page.locator('button:has-text("Serving")').first().click();
    await page.waitForTimeout(600);
    await tapSlot(page, 1);
    check(`${label}: serve receive appears when they serve`, await present(page, "SR_2"));
    check(`${label}: and nobody shows serve actions`, !(await present(page, "ACE")));
    check(`${label}: there is a way to correct the court`, (await page.locator('button:has-text("Fix the lineup")').count()) > 0);

    // --- buttons must not move -------------------------------------------
    const boxes: Record<string, Record<string, number[]>> = {};
    for (const n of [1, 2, 3, 4, 5, 6]) {
      await tapSlot(page, n);
      boxes[`slot${n}`] = await cellBoxes(page);
    }
    const first = boxes.slot1;
    const ids = Object.keys(first);
    // Guard the guard. A measurement that finds nothing would otherwise report
    // "nothing moved" and pass, which is how this section first went green.
    check(`${label}: all 15 actions have a cell`, ids.length === 15, `${ids.length} cells`);
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
      if (moved) break;
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
