// Live set win probability.
//
// A volleyball set is a race to `target` points, win by 2. Given the current
// score and p = the probability our team wins any single rally, the chance
// we win the set is a straightforward dynamic program over every reachable
// score state. Deuce (both sides within one of the target) would recur
// forever, so it is closed out with the geometric "win two straight before
// losing two straight" identity.
//
// Pure functions only - the courtside page and the parent view both import
// this module, and the unit tests in scripts/verify-win-probability.mjs pin
// the numbers.

export interface SetRules {
  target: number; // 25 (or 15 for the deciding set)
  winBy: number; // always 2 in volleyball
}

export const STANDARD_SET: SetRules = { target: 25, winBy: 2 };
export const DECIDING_SET: SetRules = { target: 15, winBy: 2 };

// ---------------------------------------------------------------------------
// Match format: the one set rule. The courtside page, the win chance, the
// parent view and End match all decide sets and matches through the
// functions below, so they can never disagree.
//
//   Best of 3: sets 1-2 to 25, set 3 to 15; first to 2 sets.
//   Best of 5: sets 1-4 to 25, set 5 to 15; first to 3 sets.
//   Every set is win by 2 with no cap. An extra set the coach adds past the
//   format (set 4 of a best of 3) is a normal set to 25.
//
// A match saved before formats existed has no format. It is read as best of
// 5, which is the rule the app always used (sets 1-4 to 25, set 5 and later
// to 15), so nothing about a past match changes.
// ---------------------------------------------------------------------------
export type BestOf = 3 | 5;
export const DEFAULT_BEST_OF: BestOf = 3; // new matches
export function bestOfFor(saved: number | null | undefined): BestOf {
  return saved === 3 ? 3 : 5;
}

export function setRulesFor(setNumber: number, bestOf: BestOf = 5): SetRules {
  if (bestOf === 3) return setNumber === 3 ? DECIDING_SET : STANDARD_SET;
  return setNumber >= 5 ? DECIDING_SET : STANDARD_SET;
}

export function setsToWin(bestOf: BestOf): number {
  return bestOf === 3 ? 2 : 3;
}

// Who has won the set at this score, if anyone.
export function setWinner(us: number, them: number, rules: SetRules = STANDARD_SET): "us" | "them" | null {
  if (us >= rules.target && us - them >= rules.winBy) return "us";
  if (them >= rules.target && them - us >= rules.winBy) return "them";
  return null;
}

// Sets won and lost by the rule above, and the match winner once a team has
// won enough of them. An unfinished set counts for nobody.
export function matchTally(
  sets: ReadonlyArray<{ us: number; them: number }>,
  bestOf: BestOf,
): { won: number; lost: number; winner: "us" | "them" | null } {
  let won = 0;
  let lost = 0;
  sets.forEach((s, i) => {
    const w = setWinner(s.us, s.them, setRulesFor(i + 1, bestOf));
    if (w === "us") won += 1;
    else if (w === "them") lost += 1;
  });
  const need = setsToWin(bestOf);
  const winner = won >= need && won > lost ? "us" : lost >= need && lost > won ? "them" : null;
  return { won, lost, winner };
}

const P_MIN = 0.001;
const P_MAX = 0.999;
function clampP(p: number) {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(P_MAX, Math.max(P_MIN, p));
}

// Results are memoized per (rules, us, them, p): the same states come up
// again and again during a match, and across matches at the same score.
const CACHE_LIMIT = 20000;
const cache = new Map<string, number>();

export function setWinProbability(
  us: number,
  them: number,
  p: number,
  rules: SetRules = STANDARD_SET,
): number {
  if (rules.winBy !== 2) throw new Error("setWinProbability supports win-by-2 sets only");
  const a0 = Math.max(0, Math.floor(us));
  const b0 = Math.max(0, Math.floor(them));
  const pc = clampP(p);
  const key = `${rules.target}:${a0}:${b0}:${pc.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const q = 1 - pc;
  // P(win the deuce from level) = p^2 / (p^2 + q^2)
  const tie = (pc * pc) / (pc * pc + q * q);
  const edge = rules.target - 1; // once both sides are here it's win-by-2 territory

  const memo = new Map<number, number>();
  const solve = (a: number, b: number): number => {
    if (a >= rules.target && a - b >= 2) return 1;
    if (b >= rules.target && b - a >= 2) return 0;
    if (a >= edge && b >= edge) {
      // Only the difference matters now: -1, 0 or +1.
      const d = a - b;
      if (d === 0) return tie;
      if (d > 0) return pc + q * tie;
      return pc * tie;
    }
    const k = a * 1024 + b;
    const m = memo.get(k);
    if (m !== undefined) return m;
    const v = pc * solve(a + 1, b) + q * solve(a, b + 1);
    memo.set(k, v);
    return v;
  };

  const result = solve(a0, b0);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}

// Blend of this set's rally record with the team's history. Early in a set
// (fewer than 6 rallies) the history carries twice the weight it does later,
// so a 3-0 start doesn't read as a 100% team.
// Prior weight (in rallies) for the historical rate before / after 6 rallies.
export const PRIOR_WEIGHT_EARLY = 40;
export const PRIOR_WEIGHT_LATE = 20;

function clampRate(p: number): number {
  return Math.min(0.95, Math.max(0.05, p));
}

export function estimateRallyWinRate(args: {
  setUs: number;
  setThem: number;
  historicalRate?: number | null;
}): number {
  const setUs = Math.max(0, args.setUs);
  const played = setUs + Math.max(0, args.setThem);
  const raw = args.historicalRate;
  const prior = clampRate(typeof raw === "number" && Number.isFinite(raw) ? raw : 0.5);
  // Beta-style shrinkage toward the prior. A race to 25 is very sensitive
  // to p (a 0.6 team wins a set ~93% of the time from 0-0), so a light prior
  // makes a 3-0 start read as 97% - jumpy and not believable courtside. The
  // weight starts at 40 rallies' worth of history and eases down to 20 once
  // 6 rallies have been played, so the set's own rallies matter more as the
  // set goes on but never swamp the score itself.
  const weight = PRIOR_WEIGHT_EARLY - Math.min(played, 6) * ((PRIOR_WEIGHT_EARLY - PRIOR_WEIGHT_LATE) / 6);
  return clampRate((setUs + weight * prior) / (played + weight));
}

// Invert the set model: which per-rally p produces this set win rate? Used to
// turn a team's past set record into a historical rally rate.
export function rallyRateFromSetWinRate(setRate: number, rules: SetRules = STANDARD_SET): number {
  const target = Math.min(0.999, Math.max(0.001, setRate));
  let lo = 0.05;
  let hi = 0.95;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (setWinProbability(0, 0, mid, rules) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface SetWinChance {
  // 0-100, or null until enough rallies have been played
  pct: number | null;
  // per-rally estimate the current number is based on
  p: number;
  rallies: number;
  // probability after every point in the set (0-1), for the sparkline
  history: number[];
  decided: "us" | "them" | null;
}

export const MIN_RALLIES_TO_SHOW = 3;

// One call for both surfaces. `points` is the sequence of [us, them] scores
// after each point in the set (an initial [0, 0] is optional).
export function computeSetWinChance(
  points: ReadonlyArray<readonly [number, number]>,
  opts: { setNumber: number; bestOf?: BestOf; historicalRate?: number | null; minRallies?: number },
): SetWinChance {
  const rules = setRulesFor(opts.setNumber, opts.bestOf);
  const minRallies = opts.minRallies ?? MIN_RALLIES_TO_SHOW;
  const seq: Array<readonly [number, number]> = points.length > 0 && points[0][0] === 0 && points[0][1] === 0 ? [...points] : [[0, 0], ...points];
  const history: number[] = [];
  let p = estimateRallyWinRate({ setUs: 0, setThem: 0, historicalRate: opts.historicalRate });
  for (const [u, t] of seq) {
    p = estimateRallyWinRate({ setUs: u, setThem: t, historicalRate: opts.historicalRate });
    history.push(setWinProbability(u, t, p, rules));
  }
  const [us, them] = seq[seq.length - 1];
  const decided = setWinner(us, them, rules);
  const rallies = us + them;
  const last = history[history.length - 1] ?? 0.5;
  const pct = decided ? (decided === "us" ? 100 : 0) : rallies >= minRallies ? Math.round(last * 100) : null;
  return { pct, p, rallies, history, decided };
}
