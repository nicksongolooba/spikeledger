// Lock down the Bank Account rules with concrete numeric cases.
// Run with: node --import tsx scripts/verify-bank-account.mjs
import {
  calculateBankAccount,
  calculateAggregateBankAccount,
} from "../src/engine/bank-account.ts";

const cases = [];
function eq(actual, expected, label) {
  cases.push({ label, ok: actual === expected, actual, expected });
}
function eqClose(actual, expected, label, eps = 1e-9) {
  cases.push({
    label,
    ok: Math.abs(actual - expected) < eps,
    actual,
    expected,
  });
}

function baseLine(overrides = {}) {
  return {
    kills: 0,
    attackErrors: 0,
    aces: 0,
    serveErrors: 0,
    blocks: 0,
    blockErrors: 0,
    assists: 0,
    sr0: 0,
    sr1: 0,
    sr2: 0,
    sr3: 0,
    generalErrors: 0,
    ...overrides,
  };
}

// === 1. Libero/DS rules =====================================================
// SR 2 should count as deposit; attack/net errors should NOT count.
{
  const libero = calculateBankAccount(
    baseLine({ sr2: 5, sr3: 2, attackErrors: 3, blockErrors: 1, sr0: 1 }),
    "L",
  );
  // Deposits: sr2 (5) + sr3 (2) = 7
  // Withdrawals: sr0 (1) = 1   (attackErrors and blockErrors ignored for libero)
  eq(libero.deposits, 7, "Libero deposits = sr2+sr3");
  eq(libero.withdrawals, 1, "Libero withdrawals = sr0 only (no attackErr/netErr)");
  eq(libero.balance, 6, "Libero balance = 7-1");
  eq(libero.rating, "GREEN", "Libero rating GREEN (ratio 7/8 = 0.875)");
}

// SR 1 should be neutral for libero (per Phase-1 spec).
{
  const lib = calculateBankAccount(baseLine({ sr1: 10 }), "L");
  eq(lib.deposits, 0, "Libero: SR 1 is neutral (no deposit)");
  eq(lib.withdrawals, 0, "Libero: SR 1 is neutral (no withdrawal)");
}

// === 2. Hitter rules ========================================================
// SR 2 should be NEUTRAL, only SR 3 counts as deposit.
// Attack and net errors DO count.
{
  const hitter = calculateBankAccount(
    baseLine({
      kills: 8,
      attackErrors: 3,
      blockErrors: 1,
      sr2: 5,
      sr3: 2,
      sr0: 1,
    }),
    "OH",
  );
  // Deposits: kills (8) + sr3 (2) = 10  (sr2 ignored for hitter)
  // Withdrawals: attackErrors (3) + blockErrors (1) + sr0 (1) = 5
  eq(hitter.deposits, 10, "Hitter deposits = kills + sr3 only");
  eq(hitter.withdrawals, 5, "Hitter withdrawals = attackErr + netErr + sr0");
  eq(hitter.balance, 5, "Hitter balance = 10-5");
  eq(hitter.rating, "BLUE", "Hitter rating BLUE (ratio 10/15 ≈ 0.667)... wait check threshold");
  // 10/15 = 0.6666 → GREEN (≥ 0.65)
  cases.pop();
  eq(hitter.rating, "GREEN", "Hitter rating GREEN (ratio 10/15 = 0.667 ≥ 0.65)");
}

// === 3. Setter/Middle rules =================================================
// No SR counts either way. Attack and net errors DO count.
{
  const setter = calculateBankAccount(
    baseLine({
      assists: 15,
      kills: 2,
      attackErrors: 1,
      blockErrors: 0,
      sr0: 5,
      sr2: 3,
      sr3: 1,
    }),
    "S",
  );
  // Deposits: assists (15) + kills (2) = 17  (no SR)
  // Withdrawals: attackErrors (1) = 1  (no SR)
  eq(setter.deposits, 17, "Setter deposits = assists+kills (no SR)");
  eq(setter.withdrawals, 1, "Setter withdrawals = attackErr only (no SR)");
}

// === 4. Rating thresholds at exact boundaries ===============================
// ratio = 0.65 exact → GREEN
{
  const r = calculateBankAccount(baseLine({ kills: 13, attackErrors: 7 }), "OH");
  eqClose(r.ratio, 13 / 20, "Threshold ratio = 0.65");
  eq(r.rating, "GREEN", "Ratio 0.65 → GREEN");
}
// ratio = 0.50 → BLUE
{
  const r = calculateBankAccount(baseLine({ kills: 5, attackErrors: 5 }), "OH");
  eq(r.rating, "BLUE", "Ratio 0.50 → BLUE");
}
// ratio = 0.35 → ORANGE
{
  const r = calculateBankAccount(baseLine({ kills: 7, attackErrors: 13 }), "OH");
  eq(r.rating, "ORANGE", "Ratio 0.35 → ORANGE");
}
// ratio = 0.20 → RED
{
  const r = calculateBankAccount(baseLine({ kills: 2, attackErrors: 8 }), "OH");
  eq(r.rating, "RED", "Ratio 0.20 → RED");
}
// No data → GREY
{
  const r = calculateBankAccount(baseLine(), "OH");
  eq(r.rating, "GREY", "No data → GREY");
  eq(r.balance, 0, "No data → balance 0");
}

// === 5. Dual-role aggregate ================================================
// Jordan: 2 matches as RS (hitter), 2 matches as L (libero).
// Same raw stats in each; the position-rule difference should show up.
{
  const rsMatchLine = baseLine({ kills: 5, sr2: 3, sr3: 1, attackErrors: 2 });
  const liberoMatchLine = baseLine({
    kills: 0,         // liberos don't attack
    sr2: 5,
    sr3: 2,
    sr0: 1,
    attackErrors: 0,
  });
  const lines = [
    { ...rsMatchLine, positionPlayed: "RS" },
    { ...rsMatchLine, positionPlayed: "RS" },
    { ...liberoMatchLine, positionPlayed: "L" },
    { ...liberoMatchLine, positionPlayed: "L" },
  ];
  const agg = calculateAggregateBankAccount(lines, "RS");
  // Per RS match (hitter rules): deposits = kills (5) + sr3 (1) = 6; withdrawals = attackErr (2)
  //   → 2 matches: deposits 12, withdrawals 4
  // Per L match (libero rules): deposits = sr2 (5) + sr3 (2) = 7; withdrawals = sr0 (1)
  //   → 2 matches: deposits 14, withdrawals 2
  // Aggregate: deposits = 12+14 = 26, withdrawals = 4+2 = 6
  eq(agg.deposits, 26, "Dual-role: deposits sum across rule sets");
  eq(agg.withdrawals, 6, "Dual-role: withdrawals sum across rule sets");
  eq(agg.balance, 20, "Dual-role: balance 26-6");
  eq(agg.positionGroup, null, "Dual-role: positionGroup null (mixed)");
}

// === 6. attackErrors don't penalize liberos in aggregate =====================
{
  const lines = [
    { ...baseLine({ kills: 4, attackErrors: 6, sr3: 1 }), positionPlayed: "L" },
  ];
  const agg = calculateAggregateBankAccount(lines, "L");
  // Under libero rules, attackErrors are ignored even if present in data.
  eq(agg.withdrawals, 0, "Libero aggregate: attackErrors NOT a withdrawal");
}

// === 7. Setter SR 0 does NOT count ==========================================
{
  const r = calculateBankAccount(baseLine({ assists: 10, sr0: 5 }), "S");
  // For setter: no SR rules; sr0 ignored.
  eq(r.withdrawals, 0, "Setter: sr0 NOT a withdrawal");
  eq(r.deposits, 10, "Setter: assists still counted");
}

// === Report ================================================================
let pass = 0;
for (const c of cases) {
  const mark = c.ok ? "✓" : "✗";
  console.log(`  ${mark} ${c.label}${c.ok ? "" : `  (got ${c.actual}, expected ${c.expected})`}`);
  pass += c.ok ? 1 : 0;
}
console.log(`\n${pass} / ${cases.length} checks passed`);
process.exit(pass === cases.length ? 0 : 1);
