import { test } from "node:test";
import assert from "node:assert/strict";
import { bestOfFor, matchTally, setRulesFor, setWinner, setsToWin } from "./win-probability";

const target = (setNumber: number, bestOf: 3 | 5) => setRulesFor(setNumber, bestOf).target;

test("best of 3: sets 1 and 2 to 25, set 3 to 15, extra sets to 25", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => target(n, 3)), [25, 25, 15, 25, 25]);
});

test("best of 5: sets 1 to 4 to 25, set 5 to 15", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => target(n, 5)), [25, 25, 25, 25, 15]);
});

test("no saved format is best of 5, exactly the old rule", () => {
  assert.equal(bestOfFor(null), 5);
  assert.equal(bestOfFor(undefined), 5);
  assert.equal(bestOfFor(5), 5);
  assert.equal(bestOfFor(3), 3);
  for (const n of [1, 2, 3, 4, 5]) assert.equal(setRulesFor(n).target, n >= 5 ? 15 : 25);
});

test("win by 2 with no cap", () => {
  const deciding = setRulesFor(3, 3);
  assert.equal(setWinner(15, 13, deciding), "us");
  assert.equal(setWinner(15, 14, deciding), null);
  assert.equal(setWinner(21, 23, deciding), "them");
  const normal = setRulesFor(1, 3);
  assert.equal(setWinner(25, 24, normal), null);
  assert.equal(setWinner(31, 29, normal), "us");
  assert.equal(setWinner(15, 13, normal), null);
});

test("sets to win the match", () => {
  assert.equal(setsToWin(3), 2);
  assert.equal(setsToWin(5), 3);
});

test("the match tally counts finished sets only", () => {
  assert.deepEqual(matchTally([{ us: 25, them: 20 }, { us: 18, them: 25 }, { us: 15, them: 13 }], 3), { won: 2, lost: 1, winner: "us" });
  assert.deepEqual(matchTally([{ us: 25, them: 20 }, { us: 18, them: 25 }, { us: 24, them: 23 }], 3), { won: 1, lost: 1, winner: null });
  // The same 15-13 third set is unfinished in best of 5 (set 3 goes to 25).
  assert.deepEqual(matchTally([{ us: 25, them: 20 }, { us: 18, them: 25 }, { us: 15, them: 13 }], 5), { won: 1, lost: 1, winner: null });
  assert.deepEqual(matchTally([{ us: 25, them: 20 }, { us: 25, them: 22 }], 3).winner, "us");
  assert.deepEqual(matchTally([{ us: 25, them: 20 }, { us: 25, them: 22 }], 5).winner, null);
  assert.deepEqual(matchTally([{ us: 20, them: 25 }, { us: 22, them: 25 }, { us: 23, them: 25 }], 5), { won: 0, lost: 3, winner: "them" });
});
