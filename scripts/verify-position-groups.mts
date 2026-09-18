// Position groups: one definition, correct names, and the setter/middle split.
//
// There used to be three definitions of a position group. The engine had a
// three-way type that lumped setters and middles together, the positions
// library had a four-way one that did not, and the bar chart had its own
// labels. They are now one.
//
// The names changed too. "Hitter" as the name of a category that excludes
// middles is wrong volleyball, because a middle is a hitter.
//
// Run:  node --env-file=.env --import tsx scripts/verify-position-groups.mts

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Position, StatLine } from "@prisma/client";
import {
  POSITION_GROUP,
  POSITION_GROUP_LABELS,
  POSITION_GROUP_ORDER,
  positionGroupOf,
} from "@/lib/positions";
import { POSITION_GROUP_MAP, calculateBankAccount } from "@/engine/bank-account";

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

// One fixed line, scored as every position. Nothing random: these numbers are
// what the engine produced before the rename, so if any of them move the
// refactor moved something it should not have.
const LINE = {
  id: "x", matchId: "m", playerId: "p",
  kills: 5, attackErrors: 2, attackAttempts: 20,
  aces: 1, serveErrors: 1, serveAttempts: 12,
  blocks: 2, blockErrors: 1,
  assists: 3, settingErrors: 0,
  sr0: 1, sr1: 1, sr2: 2, sr3: 3,
  generalErrors: 1, digs: 4,
  setsPlayed: 4, didNotPlay: false, positionPlayed: null,
} as unknown as StatLine;

function score(pos: Position, mode: "positions" | "universal" = "positions") {
  const r = calculateBankAccount(LINE, pos, mode);
  return { deposits: r.deposits, withdrawals: r.withdrawals, balance: r.balance, group: r.positionGroup };
}

function main() {
  // ------------------------------------------------------- one definition
  console.log("\n1. One definition");
  check("the engine's map is the positions library's map", POSITION_GROUP_MAP === POSITION_GROUP);
  check("and the helper agrees", positionGroupOf("MB") === POSITION_GROUP.MB);
  check("there are four groups", POSITION_GROUP_ORDER.length === 4);
  check(
    "every position maps into one of them",
    (["OH", "RS", "OPP", "MB", "S", "L", "DS", "UTIL"] as Position[]).every((p) =>
      POSITION_GROUP_ORDER.includes(POSITION_GROUP[p]),
    ),
  );

  // --------------------------------------------------------------- names
  console.log("\n2. Names");
  check('the pin group is not called "hitter"', !Object.keys(POSITION_GROUP_LABELS).includes("hitter"));
  check("pin hitters", POSITION_GROUP_LABELS.pin_hitter === "Pin hitters");
  check("middle blockers", POSITION_GROUP_LABELS.middle_blocker === "Middle blockers");
  check("setters", POSITION_GROUP_LABELS.setter === "Setters");
  check("liberos / DS", POSITION_GROUP_LABELS.libero_ds === "Liberos / DS");
  check("OH, RS and OPP are pin hitters", POSITION_GROUP.OH === "pin_hitter" && POSITION_GROUP.RS === "pin_hitter" && POSITION_GROUP.OPP === "pin_hitter");
  check("MB is its own group", POSITION_GROUP.MB === "middle_blocker");
  check("S is its own group", POSITION_GROUP.S === "setter");
  check("L and DS stay together", POSITION_GROUP.L === "libero_ds" && POSITION_GROUP.DS === "libero_ds");
  check("UTIL stays with the pin hitters", POSITION_GROUP.UTIL === "pin_hitter");

  // No old group name survives anywhere in src.
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name)) {
        const t = readFileSync(full, "utf8");
        if (/"setter_middle"|'setter_middle'/.test(t)) offenders.push(`${full} (setter_middle)`);
        // A bare group literal, as opposed to prose about a hitter.
        if (/(?:group|PositionGroup|appliesTo)[^\n]{0,60}"hitter"/.test(t)) offenders.push(`${full} (hitter)`);
      }
    }
  };
  walk("src");
  check("no old group name is left in src", offenders.length === 0, offenders.join(", "));

  // -------------------------------------------------------- unchanged output
  console.log("\n3. Nothing moved that should not have");
  const pin = score("OH");
  check("pin hitter: 14 deposits", pin.deposits === 14, String(pin.deposits));
  check("pin hitter: 6 withdrawals", pin.withdrawals === 6, String(pin.withdrawals));
  check("pin hitter: balance +8", pin.balance === 8, String(pin.balance));
  check("RS and OPP score identically to OH", JSON.stringify(score("RS")) === JSON.stringify(pin) && JSON.stringify(score("OPP")) === JSON.stringify(pin));
  check("UTIL still scores as a pin hitter in positions mode", JSON.stringify(score("UTIL")) === JSON.stringify(pin));

  const lib = score("L");
  check("libero: 16 deposits, both good passes credited", lib.deposits === 16, String(lib.deposits));
  check("libero: 3 withdrawals, attack and net errors ignored", lib.withdrawals === 3, String(lib.withdrawals));
  check("libero: balance +13", lib.balance === 13, String(lib.balance));
  check("DS scores identically to L", JSON.stringify(score("DS")) === JSON.stringify(lib));

  const uni = score("UTIL", "universal");
  check("universal: 20 deposits", uni.deposits === 20, String(uni.deposits));
  check("universal: 6 withdrawals", uni.withdrawals === 6, String(uni.withdrawals));
  check("universal: no group on the result", uni.group === null);

  // ------------------------------------------------------------ the split
  console.log("\n4. The split");
  const setter = score("S");
  const middle = score("MB");
  check("a setter and a middle are no longer in the same group", setter.group !== middle.group, `${setter.group} vs ${middle.group}`);
  check("the setter's group is setter", setter.group === "setter");
  check("the middle's group is middle_blocker", middle.group === "middle_blocker");
  check("neither is graded on serve receive", setter.deposits === 11 && middle.deposits === 11, `${setter.deposits} / ${middle.deposits}`);

  // The honest state of it: the split is structural for now. Their numbers are
  // still identical because the per-group calibration that would separate them
  // was deliberately deferred. This assertion is what flips when it lands.
  check(
    "their numbers are still identical, because the calibration is deferred",
    setter.balance === middle.balance,
    `${setter.balance} vs ${middle.balance}`,
  );
  check("and both differ from a pin hitter, as they did before", setter.balance !== pin.balance);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
