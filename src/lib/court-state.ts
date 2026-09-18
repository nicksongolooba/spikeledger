// Per-set stats out of per-match counters.
//
// Stats are stored as running totals on one StatLine per player per match, and
// the courtside screen sends increments without a set number. So there is no
// per-set stat line to read.
//
// What there is: MatchCourtState snapshots every player's match totals the
// first time a set's lineup is synced. Current totals minus that snapshot is
// exactly what the player did in this set, which is what the parent view needs
// when a child comes off the court and those numbers have to stay on screen,
// correctly labelled, instead of resetting.

// The raw counters the parent live view reads. Anything not here (attempts,
// setting errors) is not shown live, so it is not worth snapshotting.
export const BASELINE_FIELDS = [
  "kills",
  "aces",
  "blocks",
  "digs",
  "assists",
  "serveErrors",
  "attackErrors",
  "generalErrors",
  "blockErrors",
  "settingErrors",
  "digErrors",
  "sr0",
  "sr1",
  "sr2",
  "sr3",
] as const;

export type BaselineField = (typeof BASELINE_FIELDS)[number];
export type PlayerCounters = Record<BaselineField, number>;
export type MatchBaseline = Record<string, PlayerCounters>;

export function zeroCounters(): PlayerCounters {
  return Object.fromEntries(BASELINE_FIELDS.map((f) => [f, 0])) as PlayerCounters;
}

export function countersFrom(line: Partial<Record<BaselineField, number>>): PlayerCounters {
  return Object.fromEntries(
    BASELINE_FIELDS.map((f) => [f, Number(line[f] ?? 0)]),
  ) as PlayerCounters;
}

export function baselineFromLines(
  lines: ({ playerId: string } & Partial<Record<BaselineField, number>>)[],
): MatchBaseline {
  const out: MatchBaseline = {};
  for (const line of lines) out[line.playerId] = countersFrom(line);
  return out;
}

// One player's snapshot out of the stored JSON. A player with no snapshot was
// not in the match when the set started, so every counter is zero and their
// per-set figures equal their match figures.
export function playerBaseline(stored: unknown, playerId: string): PlayerCounters {
  if (!stored || typeof stored !== "object") return zeroCounters();
  const row = (stored as Record<string, unknown>)[playerId];
  if (!row || typeof row !== "object") return zeroCounters();
  return countersFrom(row as Partial<Record<BaselineField, number>>);
}

// Counters recorded since the snapshot. Clamped at zero: an undo after the set
// started can take a total below its own baseline, and a negative kill count
// on a parent's phone would be worse than showing none.
export function countersSince(
  line: Partial<Record<BaselineField, number>>,
  baseline: PlayerCounters,
): PlayerCounters {
  return Object.fromEntries(
    BASELINE_FIELDS.map((f) => [f, Math.max(0, Number(line[f] ?? 0) - baseline[f])]),
  ) as PlayerCounters;
}

export interface CourtStateRow {
  onCourt: string[];
  appeared: string[];
  roster: string[];
}

// Fold a lineup sync into whatever is already stored for that set.
//
// `onCourt` is replaced: it is a statement about this moment. `appeared` and
// `roster` only ever grow, which is what stops a substitution from erasing the
// fact that a child was on the court earlier in the set.
export function mergeCourtState(
  existing: CourtStateRow | null,
  incoming: { onCourt: string[]; roster?: string[] },
): CourtStateRow {
  const appeared = [...new Set([...(existing?.appeared ?? []), ...incoming.onCourt])];
  const roster = [...new Set([...(existing?.roster ?? []), ...(incoming.roster ?? []), ...appeared])];
  return { onCourt: [...incoming.onCourt], appeared, roster };
}
