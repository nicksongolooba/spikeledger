import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { InsightProvider } from "./types";

// Cache TTL is intentionally far in the future - invalidation is driven by the
// stats hash being baked into the cache key. When stats change, the key changes,
// so the old row is naturally orphaned.
const TTL_DAYS = 365;

interface StableJson {
  [k: string]: unknown;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  const obj = value as StableJson;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") +
    "}"
  );
}

export function hashRequest(input: unknown): string {
  const json = stableStringify(input);
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 32);
}

interface CachedRow<T> {
  response: T;
  provider: InsightProvider;
  createdAt: Date;
}

export async function readCache<T>(cacheKey: string): Promise<CachedRow<T> | null> {
  const row = await prisma.aIInsightCache.findUnique({
    where: { cacheKey },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.aIInsightCache
      .delete({ where: { cacheKey } })
      .catch(() => undefined);
    return null;
  }
  return {
    response: row.response as T,
    provider: row.provider as InsightProvider,
    createdAt: row.createdAt,
  };
}

export async function writeCache(
  cacheKey: string,
  kind: "player" | "team",
  response: unknown,
  provider: InsightProvider,
) {
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 3600 * 1000);
  await prisma.aIInsightCache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      kind,
      response: response as never,
      provider,
      expiresAt,
    },
    update: {
      response: response as never,
      provider,
      expiresAt,
    },
  });
}

export async function invalidateCache(cacheKey: string) {
  await prisma.aIInsightCache.delete({ where: { cacheKey } }).catch(() => undefined);
}
