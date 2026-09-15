import { NextResponse } from "next/server";
import { z } from "zod";
import { Position } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCoachOwnsMatch } from "@/lib/match-access";
import { invalidateLive } from "@/lib/live-cache";

const LineupSchema = z.object({
  entries: z
    .array(
      z.object({
        playerId: z.string().min(1),
        positionPlayed: z.nativeEnum(Position),
      }),
    )
    .min(1)
    .max(12),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertCoachOwnsMatch(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = LineupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Confirm every player belongs to this team.
  const teamId = owns.tournament.teamId;
  const playerIds = parsed.data.entries.map((e) => e.playerId);
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, teamId },
    select: { id: true },
  });
  if (players.length !== playerIds.length) {
    return NextResponse.json(
      { error: "One or more players don't belong to this team." },
      { status: 400 },
    );
  }

  // Upsert StatLine stubs so positionPlayed is locked in even before any stat
  // is recorded - important for dual-role players (Jordan, Sam).
  const ops = parsed.data.entries.map((e) =>
    prisma.statLine.upsert({
      where: {
        matchId_playerId: { matchId: params.id, playerId: e.playerId },
      },
      create: {
        matchId: params.id,
        playerId: e.playerId,
        positionPlayed: e.positionPlayed,
      },
      update: { positionPlayed: e.positionPlayed },
    }),
  );
  const results = await prisma.$transaction(ops);
  invalidateLive({ matchId: params.id });

  return NextResponse.json(results);
}
