// In-process cache for the parent live view.
//
// Every parent poll needs two things: the team's live context (who may watch
// which player, which match is current, the team's rally history) and the
// current match (stat lines, set scores). Both are cached here for
// LIVE_TTL_MS, so however many parents watch a match, this server process
// reads it from Neon at most once per window. Concurrent misses are
// coalesced into one load, so a burst of 200 polls landing on a cold entry
// still costs one query set.
//
// Invalidation: every route that writes match data calls invalidateLive()
// with the match (and team) id, which drops the entry so the next poll reads
// fresh data immediately. On Vercel this cache lives inside one function
// instance; other instances that hold a copy fall back to the TTL, so a
// write is visible everywhere within LIVE_TTL_MS at worst. We chose this over
// next/cache's unstable_cache because that API serves stale entries and
// revalidates in the background - after a coach records a stat the first
// poll would still get the old numbers - and because a Data Cache round
// trip per poll costs more than this payload is worth. If cross-instance
// invalidation ever matters, swap the Map for Vercel KV behind the same two
// functions.

export const LIVE_TTL_MS = 10_000;

interface Entry<T> {
  value?: T;
  expiresAt: number; // ms epoch; 0 while the first load is in flight
  inflight?: Promise<T>;
}

// State lives on globalThis, not in module scope: Next bundles each route
// handler separately (the score route and the poll route would otherwise
// hold different Maps), dev HMR re-evaluates modules, and test runners can
// load a file twice. One process, one cache.
interface LiveCacheState {
  entries: Map<string, Entry<unknown>>;
  counters: { hits: number; fills: number; coalesced: number; invalidations: number };
}
const globalState = globalThis as unknown as { __spikeledgerLiveCache?: LiveCacheState };
const state: LiveCacheState =
  globalState.__spikeledgerLiveCache ??
  (globalState.__spikeledgerLiveCache = {
    entries: new Map(),
    counters: { hits: 0, fills: 0, coalesced: 0, invalidations: 0 },
  });
const { entries, counters } = state;

export function teamLiveKey(teamId: string) {
  return `team:${teamId}`;
}
export function matchLiveKey(matchId: string) {
  return `match:${matchId}`;
}

// Returns the cached value for `key`, loading it (once) when missing or
// expired. Callers that arrive while a load is running await that same load.
export async function cachedLive<T>(
  key: string,
  load: () => Promise<T>,
  ttlMs: number = LIVE_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const entry = entries.get(key) as Entry<T> | undefined;
  if (entry && entry.expiresAt > now) {
    counters.hits += 1;
    return entry.value as T;
  }
  if (entry?.inflight) {
    counters.coalesced += 1;
    return entry.inflight;
  }
  counters.fills += 1;
  const inflight = load()
    .then((value) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      entries.delete(key);
      throw err;
    });
  entries.set(key, { value: entry?.value, expiresAt: 0, inflight });
  if (entries.size > 1000) sweep();
  return inflight;
}

// Drop the entries a write may have changed. Cheap to call; harmless when
// nothing is cached.
export function invalidateLive(ids: { teamId?: string; matchId?: string }) {
  if (ids.teamId) entries.delete(teamLiveKey(ids.teamId));
  if (ids.matchId) entries.delete(matchLiveKey(ids.matchId));
  counters.invalidations += 1;
}

export function liveCacheStats() {
  return { ...counters, size: entries.size };
}

// Tests only.
export function resetLiveCache() {
  entries.clear();
  counters.hits = counters.fills = counters.coalesced = counters.invalidations = 0;
}

function sweep() {
  const now = Date.now();
  for (const [key, e] of entries) {
    if (!e.inflight && e.expiresAt <= now) entries.delete(key);
  }
}
