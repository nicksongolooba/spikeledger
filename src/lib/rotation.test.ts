import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyRally,
  nextRotation,
  servingAssertionFor,
  type RallyOutcome,
  type RallyState,
} from "./rotation";
import type { StatActionId } from "./stat-actions";

test("nextRotation cycles R1..R6 and wraps", () => {
  assert.equal(nextRotation(1), 2);
  assert.equal(nextRotation(5), 6);
  assert.equal(nextRotation(6), 1);
});

test("our side-out: we score while they serve -> take serve, rotate, flash", () => {
  const out = applyRally({ serving: "them", rotation: 3 }, "us");
  assert.equal(out.serving, "us");
  assert.equal(out.rotation, 4);
  assert.equal(out.rotated, true);
});

test("our side-out wraps R6 -> R1", () => {
  const out = applyRally({ serving: "them", rotation: 6 }, "us");
  assert.equal(out.rotation, 1);
  assert.equal(out.rotated, true);
});

test("their side-out: they score while we serve -> they serve, no rotation", () => {
  const out = applyRally({ serving: "us", rotation: 2 }, "them");
  assert.equal(out.serving, "them");
  assert.equal(out.rotation, 2);
  assert.equal(out.rotated, false);
});

test("serving team scores (us on our serve): no change, no rotation", () => {
  const out = applyRally({ serving: "us", rotation: 2 }, "us");
  assert.equal(out.serving, "us");
  assert.equal(out.rotation, 2);
  assert.equal(out.rotated, false);
});

test("serving team scores (them on their serve): no change, no rotation", () => {
  const out = applyRally({ serving: "them", rotation: 2 }, "them");
  assert.equal(out.serving, "them");
  assert.equal(out.rotation, 2);
  assert.equal(out.rotated, false);
});

test("ace corrects a wrong toggle to us without rotating", () => {
  // Toggle wrongly says "them", but an ace proves we were serving.
  const out = applyRally({ serving: "them", rotation: 4 }, "us", "us");
  assert.equal(out.serving, "us");
  assert.equal(out.rotation, 4, "no rotation - we were the serving team");
  assert.equal(out.rotated, false);
});

test("ace with toggle already correct: no-op on serve/rotation", () => {
  const out = applyRally({ serving: "us", rotation: 4 }, "us", "us");
  assert.equal(out.serving, "us");
  assert.equal(out.rotation, 4);
  assert.equal(out.rotated, false);
});

test("serve error hands serve to them off our serve, no rotation", () => {
  const out = applyRally({ serving: "us", rotation: 4 }, "them", "us");
  assert.equal(out.serving, "them");
  assert.equal(out.rotation, 4);
  assert.equal(out.rotated, false);
});

test("serve error corrects a wrong toggle before handing serve over", () => {
  // Toggle wrongly says "them"; serve error asserts we served, then loses it.
  const out = applyRally({ serving: "them", rotation: 4 }, "them", "us");
  assert.equal(out.serving, "them");
  assert.equal(out.rotation, 4);
  assert.equal(out.rotated, false);
});

test("six straight side-outs return to the starting rotation", () => {
  let state = { serving: "them" as const, rotation: 1 };
  for (let i = 0; i < 6; i++) {
    // Win a side-out, then concede serve back so the next point is a side-out.
    const won = applyRally(state, "us");
    state = { serving: "them", rotation: won.rotation };
  }
  assert.equal(state.rotation, 1);
});

test("servingAssertionFor flags only ace and serve error", () => {
  assert.equal(servingAssertionFor("ACE"), "us");
  assert.equal(servingAssertionFor("S_ERR"), "us");
  assert.equal(servingAssertionFor("KILL"), undefined);
  assert.equal(servingAssertionFor("A_ERR"), undefined);
  assert.equal(servingAssertionFor("BLOCK"), undefined);
});

// ---- Integration: drive the exact action sequence the entry page wires up.
// Mirrors MatchEntry.applyPoint: stat actions score for a side and assert who
// served (ace/serve-error only); the opponent-error button scores for us with
// no assertion. This is the spec's "test this thoroughly" walkthrough.
const SCORES_US = new Set<StatActionId>(["KILL", "ACE", "BLOCK"]);

function play(
  state: RallyState,
  action: StatActionId | "OPP_ERR",
): RallyOutcome {
  if (action === "OPP_ERR") return applyRally(state, "us");
  const scorer = SCORES_US.has(action) ? "us" : "them";
  return applyRally(state, scorer, servingAssertionFor(action));
}

test("spec walkthrough: opponent serving at R1 through a full exchange", () => {
  let s: RallyState = { serving: "them", rotation: 1 };

  // 2. KILL while they serve -> side-out: rotate to R2, we serve.
  let out = play(s, "KILL");
  assert.deepEqual(
    { serving: out.serving, rotation: out.rotation, rotated: out.rotated },
    { serving: "us", rotation: 2, rotated: true },
  );
  s = out;

  // 3. ACE on our serve -> no rotation, hold serve at R2.
  out = play(s, "ACE");
  assert.deepEqual(
    { serving: out.serving, rotation: out.rotation, rotated: out.rotated },
    { serving: "us", rotation: 2, rotated: false },
  );
  s = out;

  // 4. SERVE ERROR on our serve -> hand serve to them, no rotation, stay R2.
  out = play(s, "S_ERR");
  assert.deepEqual(
    { serving: out.serving, rotation: out.rotation, rotated: out.rotated },
    { serving: "them", rotation: 2, rotated: false },
  );
  s = out;

  // 5. Opponent error while they serve -> side-out: rotate to R3, we serve.
  out = play(s, "OPP_ERR");
  assert.deepEqual(
    { serving: out.serving, rotation: out.rotation, rotated: out.rotated },
    { serving: "us", rotation: 3, rotated: true },
  );
});

test("spec walkthrough: rotation wraps R1->...->R6->R1 over six side-outs", () => {
  let s: RallyState = { serving: "them", rotation: 1 };
  const seen: number[] = [];
  for (let i = 0; i < 6; i++) {
    const out = play(s, "KILL"); // win serve back -> rotate
    seen.push(out.rotation);
    s = { serving: "them", rotation: out.rotation }; // concede serve for next side-out
  }
  assert.deepEqual(seen, [2, 3, 4, 5, 6, 1]);
});
