// Pin the set win probability model. Run: node --import tsx scripts/verify-win-probability.mjs
import {
  DECIDING_SET,
  computeSetWinChance,
  estimateRallyWinRate,
  rallyRateFromSetWinRate,
  setRulesFor,
  setWinProbability,
  setWinner,
} from "../src/engine/win-probability.ts";

const cases = [];
function ok(cond, label, extra = "") {
  cases.push({ label, ok: cond, extra });
}
function close(actual, expected, label, eps = 1e-9) {
  cases.push({ label, ok: Math.abs(actual - expected) < eps, extra: `got ${actual}, expected ${expected}` });
}

// === 1. Even game ==========================================================
close(setWinProbability(0, 0, 0.5), 0.5, "0-0 at p=0.5 is exactly 50%");
ok(setWinProbability(12, 12, 0.5) === 0.5, "12-12 at p=0.5 is 50%");

// === 2. Big leads ==========================================================
{
  const up = setWinProbability(24, 20, 0.5);
  const down = setWinProbability(20, 24, 0.5);
  ok(up > 0.95, "24-20 is very high", `got ${up.toFixed(4)}`);
  ok(down < 0.05, "20-24 is very low", `got ${down.toFixed(4)}`);
  close(up + down, 1, "symmetry: P(a,b,p) + P(b,a,1-p) = 1");
  close(setWinProbability(24, 20, 0.5) + setWinProbability(20, 24, 0.5), 1, "mirror scores sum to 1 at p=0.5");
}

// === 3. Deuce ==============================================================
close(setWinProbability(24, 24, 0.5), 0.5, "24-24 at p=0.5 is 50%");
close(setWinProbability(24, 24, 0.6), 0.36 / (0.36 + 0.16), "24-24 at p=0.6 = p^2/(p^2+q^2)");
close(setWinProbability(25, 24, 0.5), 0.75, "25-24 at p=0.5 = p + q*tie = 75%");
close(setWinProbability(24, 25, 0.5), 0.25, "24-25 at p=0.5 = p*tie = 25%");
close(setWinProbability(30, 30, 0.5), 0.5, "30-30 still 50% (deuce never ends the recursion)");
close(setWinProbability(24, 23, 0.5), 0.5 * 1 + 0.5 * 0.5, "24-23 = p*1 + q*P(24-24)");
ok(setWinProbability(26, 24, 0.5) === 1 && setWinProbability(24, 26, 0.5) === 0, "26-24 / 24-26 are decided");

// === 4. Deciding set to 15 =================================================
ok(setRulesFor(5).target === 15 && setRulesFor(1).target === 25 && setRulesFor(4).target === 25, "sets 1-4 to 25, set 5 to 15");
close(setWinProbability(14, 14, 0.5, DECIDING_SET), 0.5, "14-14 in a 5th set is 50%");
{
  const lead = setWinProbability(14, 10, 0.5, DECIDING_SET);
  ok(lead > 0.95, "14-10 in a 5th set is very high", `got ${lead.toFixed(4)}`);
  ok(setWinner(15, 13, DECIDING_SET) === "us" && setWinner(15, 14, DECIDING_SET) === null, "5th set needs 15 and win by 2");
  ok(setWinProbability(10, 10, 0.5, DECIDING_SET) === 0.5 && setWinProbability(0, 0, 0.5, DECIDING_SET) === 0.5, "5th set from level is 50%");
  // The same lead matters more in a shorter set.
  ok(setWinProbability(10, 6, 0.5, DECIDING_SET) > setWinProbability(10, 6, 0.5), "a 10-6 lead is worth more when the set is to 15");
}

// === 5. Monotonic in p and in score ========================================
{
  let prev = 0;
  let mono = true;
  for (const p of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    const v = setWinProbability(10, 10, p);
    if (v < prev) mono = false;
    prev = v;
  }
  ok(mono, "higher p never lowers the set win probability");
  ok(setWinProbability(15, 10, 0.5) > setWinProbability(14, 10, 0.5), "another point for us raises it");
  ok(setWinProbability(15, 11, 0.5) < setWinProbability(15, 10, 0.5), "another point for them lowers it");
}

// === 6. Memoization ========================================================
{
  const a = setWinProbability(18, 15, 0.55);
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) setWinProbability(18, 15, 0.55);
  const ms = performance.now() - t0;
  close(setWinProbability(18, 15, 0.55), a, "memoized result is stable");
  ok(ms < 200, "2000 cached lookups are fast", `${ms.toFixed(1)}ms`);
}

// === 7. Rally rate estimate ================================================
close(estimateRallyWinRate({ setUs: 0, setThem: 0, historicalRate: null }), 0.5, "no rallies and no history = 0.50");
close(estimateRallyWinRate({ setUs: 0, setThem: 0, historicalRate: 0.62 }), 0.62, "no rallies yet = the historical rate");
{
  const early = estimateRallyWinRate({ setUs: 3, setThem: 0, historicalRate: 0.5 }); // weight 30: (3 + 30*0.5)/(3+30)
  const later = estimateRallyWinRate({ setUs: 9, setThem: 0, historicalRate: 0.5 }); // weight 20: (9 + 20*0.5)/(9+20)
  close(early, 18 / 33, "3-0 start with <6 rallies leans on history (0.545)");
  close(later, 19 / 29, "9-0 with 6+ rallies trusts the set more (0.655)");
  ok(early < later, "the set's own rallies count for more as it goes on");
  ok(setWinProbability(3, 0, early) < 0.9, "a 3-0 start is confident but not a lock (<90%)");
  ok(early < 0.75, "a 3-0 start never reads as 100%");
}
close(rallyRateFromSetWinRate(0.5), 0.5, "50% set rate inverts to p=0.5", 1e-4);
ok(rallyRateFromSetWinRate(0.8) > 0.5 && rallyRateFromSetWinRate(0.8) < 0.6, "80% set rate inverts to a p just above 0.5");

// === 8. Live snapshot helper ===============================================
{
  const none = computeSetWinChance([], { setNumber: 1, historicalRate: null });
  ok(none.pct === null && none.rallies === 0, "no rallies yet shows a dash");
  const two = computeSetWinChance([[1, 0], [1, 1]], { setNumber: 1 });
  ok(two.pct === null && two.history.length === 3, "under 3 rallies still shows a dash but keeps history");
  const three = computeSetWinChance([[1, 0], [2, 0], [3, 0]], { setNumber: 1 });
  ok(three.pct !== null && three.pct > 50, "3-0 shows a number above 50%", `got ${three.pct}`);
  const done = computeSetWinChance([[24, 20], [25, 20]], { setNumber: 1 });
  ok(done.pct === 100 && done.decided === "us", "a won set reads 100%");
  const lost = computeSetWinChance([[10, 24], [10, 25]], { setNumber: 3 });
  ok(lost.pct === 0 && lost.decided === "them", "a lost set reads 0%");
  const fifth = computeSetWinChance([[14, 10]], { setNumber: 5 });
  ok(fifth.pct !== null && fifth.pct > 95, "5th-set snapshot uses the race to 15", `got ${fifth.pct}`);
}

// === Report ================================================================
let pass = 0;
for (const c of cases) {
  console.log(`  ${c.ok ? "✓" : "✗"} ${c.label}${c.ok ? "" : `  (${c.extra})`}`);
  pass += c.ok ? 1 : 0;
}
console.log(`\n${pass} / ${cases.length} checks passed`);
process.exit(pass === cases.length ? 0 : 1);
