// Server-side inputs for the live set win probability.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rallyRateFromSetWinRate } from "@/engine/win-probability";

// A team's historical per-rally win rate, inferred from the set record of
// every finished match (we don't store opponent rally-by-rally data, but the
// set model can be inverted: which p produces this set win rate?). Shrunk
// toward 50% for small samples; null when there is no history at all.
export async function teamHistoricalRallyRate(
  teamId: string,
  excludeMatchId?: string,
): Promise<number | null> {
  const where: Prisma.MatchWhereInput = {
    tournament: { teamId },
    result: { not: null },
    ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
  };
  const matches = await prisma.match.findMany({
    where,
    select: { setsWon: true, setsLost: true },
  });
  let won = 0;
  let lost = 0;
  for (const m of matches) {
    won += m.setsWon;
    lost += m.setsLost;
  }
  if (won + lost === 0) return null;
  const setRate = (won + 2) / (won + lost + 4);
  return rallyRateFromSetWinRate(setRate);
}

export type ScorePoint = [number, number];

// Parse the JSON `history` column defensively - it's client-supplied.
export function parseScoreHistory(raw: unknown, max = 120): ScorePoint[] {
  if (!Array.isArray(raw)) return [];
  const out: ScorePoint[] = [];
  for (const item of raw.slice(-max)) {
    if (!Array.isArray(item) || item.length !== 2) continue;
    const [u, t] = item;
    if (typeof u !== "number" || typeof t !== "number") continue;
    if (!Number.isInteger(u) || !Number.isInteger(t) || u < 0 || t < 0 || u > 60 || t > 60) continue;
    out.push([u, t]);
  }
  return out;
}
