import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyRally,
  nextRotation,
  rotateLineup,
  servingAssertionFor,
  type RallyOutcome,
  type RallyState,
} from "./rotation";
import type { StatActionId } from "./stat-actions";
import { actionAvailability } from "./action-availability";

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

test("servingAssertionFor flags the actions that prove who served", () => {
  // Only happen on our serve.
  assert.equal(servingAssertionFor("ACE"), "us");
  assert.equal(servingAssertionFor("S_ERR"), "us");
  // Only happen against theirs: you cannot pass your own serve.
  assert.equal(servingAssertionFor("SR_0"), "them");
  assert.equal(servingAssertionFor("SR_1"), "them");
  assert.equal(servingAssertionFor("SR_2"), "them");
  assert.equal(servingAssertionFor("SR_3"), "them");
  // Prove nothing either way: they happen on both sides of the serve.
  assert.equal(servingAssertionFor("KILL"), undefined);
  assert.equal(servingAssertionFor("A_ERR"), undefined);
  assert.equal(servingAssertionFor("BLOCK"), undefined);
  assert.equal(servingAssertionFor("DIG"), undefined);
  assert.equal(servingAssertionFor("ASSIST"), undefined);
});

// The rule this exists to protect: anything servingAssertionFor speaks for is
// a repair to the serving flag, so it must never be disabled by that flag.
// Gating one on the other is what left a stale flag stuck wrong.
test("no action that corrects the serving flag is gated on it", () => {
  const ids: StatActionId[] = [
    "KILL", "ACE", "BLOCK", "ASSIST", "DIG", "S_ERR", "NET_ERR", "A_ERR",
    "SET_ERR", "DIG_ERR", "GEN_ERR", "SR_0", "SR_1", "SR_2", "SR_3",
  ];
  for (const id of ids) {
    if (!servingAssertionFor(id)) continue;
    // Available in every slot the action's own lineup rule allows, whatever
    // the serving state - because CourtContext no longer carries one.
    const slot = id === "SR_0" || id === "SR_1" || id === "SR_2" || id === "SR_3" ? 4 : 1;
    assert.equal(
      actionAvailability(id, { slot, isLibero: false }).available,
      true,
      `${id} must not be gated on the state it corrects`,
    );
  }
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

test("rotateLineup: a clockwise rotation moves P2->P1 and P1->P6", () => {
  // index 0 = position 1 (server). Players A..F at positions 1..6.
  const out = rotateLineup(["A", "B", "C", "D", "E", "F"], 1);
  // new P1 is old P2 (B); old P1 (A) drops to P6 (index 5).
  assert.deepEqual(out, ["B", "C", "D", "E", "F", "A"]);
  assert.equal(out[0], "B", "new server was at position 2");
  assert.equal(out[5], "A", "old server rotated to position 6");
});

test("rotateLineup: backward (-1) reverses a rotation", () => {
  const start = ["A", "B", "C", "D", "E", "F"];
  assert.deepEqual(rotateLineup(rotateLineup(start, 1), -1), start);
});

test("rotateLineup: six clockwise rotations return to the start", () => {
  let lineup = ["A", "B", "C", "D", "E", "F"];
  for (let i = 0; i < 6; i++) lineup = rotateLineup(lineup, 1);
  assert.deepEqual(lineup, ["A", "B", "C", "D", "E", "F"]);
});

test("rotateLineup: leaves an incomplete lineup untouched", () => {
  assert.deepEqual(rotateLineup(["A", "B", "C"], 1), ["A", "B", "C"]);
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
