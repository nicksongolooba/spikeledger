// Sliding-window rate limiter, in process. Enough to stop one stuck client
// from hammering an endpoint; on Vercel each function instance keeps its own
// window, so treat the limit as "per instance" rather than exact.

// On globalThis for the same reason as live-cache.ts: one process, one set
// of windows, whichever route bundle is asking.
const globalState = globalThis as unknown as { __spikeledgerRateLimit?: Map<string, number[]> };
const buckets: Map<string, number[]> =
  globalState.__spikeledgerRateLimit ?? (globalState.__spikeledgerRateLimit = new Map());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number; now?: number },
): RateLimitResult {
  const now = opts.now ?? Date.now();
  const since = now - opts.windowMs;
  const stamps = (buckets.get(key) ?? []).filter((t) => t > since);
  if (stamps.length >= opts.max) {
    buckets.set(key, stamps);
    const retryAfterMs = stamps[0] + opts.windowMs - now;
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  stamps.push(now);
  buckets.set(key, stamps);
  if (buckets.size > 5000) sweep(since);
  return { ok: true, remaining: opts.max - stamps.length, retryAfterSec: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

function sweep(since: number) {
  for (const [key, stamps] of buckets) {
    if (stamps.length === 0 || stamps[stamps.length - 1] <= since) buckets.delete(key);
  }
}
