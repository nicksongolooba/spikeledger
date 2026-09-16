import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCoachOwnsMatch } from "@/lib/match-access";
import { invalidateLive } from "@/lib/live-cache";
import { BASELINE_FIELDS, baselineFromLines, mergeCourtState } from "@/lib/court-state";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// Every player's match totals right now, stored once per set so the parent
// view can subtract it and show what a child did in this set alone.
async function baselineFor(tx: Tx, matchId: string): Promise<Prisma.JsonObject> {
  const lines = await tx.statLine.findMany({
    where: { matchId },
    select: { playerId: true, ...Object.fromEntries(BASELINE_FIELDS.map((f) => [f, true])) },
  });
  return baselineFromLines(lines as ({ playerId: string } & Record<string, number>)[]) as unknown as Prisma.JsonObject;
}

// POST /api/matches/[id]/court
//
// The courtside screen's lineup, synced so the parent view can tell "on court"
// from "on the bench" from "off the court right now".
//
// The existing lineup route cannot answer that: a substitution upserts a stat
// line for the player coming ON and says nothing about the one coming off, so
// the server has always known who HAS played and never who IS playing.
//
// `appeared` only ever grows within a set. That is what keeps a child's stats
// labelled "this set so far" after she comes off, instead of looking like she
// was never in.
const CourtSchema = z.object({
  setNumber: z.number().int().min(1).max(7),
  onCourt: z.array(z.string().min(1)).max(12),
  // Everyone the courtside screen had available for this match. Used to tell
  // a player who is not part of the match from one waiting on the bench.
  roster: z.array(z.string().min(1)).max(60).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertCoachOwnsMatch(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = CourtSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { setNumber, onCourt, roster } = parsed.data;

  // Every id must be a player on this team. Anything else is a bug or a
  // tampered request, and either way it must not reach a parent's screen.
  const teamId = owns.tournament.teamId;
  const ids = [...new Set([...onCourt, ...(roster ?? [])])];
  if (ids.length > 0) {
    const known = await prisma.player.count({ where: { id: { in: ids }, teamId } });
    if (known !== ids.length) {
      return NextResponse.json(
        { error: "One or more players don't belong to this team." },
        { status: 400 },
      );
    }
  }

  // Read and write together: two devices scoring the same match must not lose
  // half of `appeared` to a last-write-wins race.
  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.matchCourtState.findUnique({
      where: { matchId_setNumber: { matchId: params.id, setNumber } },
    });
    const merged = mergeCourtState(existing, { onCourt, roster });
    // Snapshot the match totals the first time a set's lineup is synced, and
    // never touch it again. Everything recorded after this point belongs to
    // this set, which is what lets the parent view show a per-set figure from
    // per-match counters.
    const baseline = existing ? (existing.baseline as Prisma.JsonObject) : await baselineFor(tx, params.id);
    return tx.matchCourtState.upsert({
      where: { matchId_setNumber: { matchId: params.id, setNumber } },
      create: { matchId: params.id, setNumber, ...merged, baseline },
      update: merged,
    });
  });

  invalidateLive({ matchId: params.id });
  return NextResponse.json(saved);
}
