import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCoachOwnsMatch } from "@/lib/match-access";
import { STAT_ACTION_FIELDS, type StatActionId } from "@/lib/stat-actions";

const BodySchema = z.object({
  playerId: z.string().min(1),
  action: z.string().min(1),
  value: z.number().int().min(1).max(20).default(1),
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
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  if (!(parsed.data.action in STAT_ACTION_FIELDS)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const field = STAT_ACTION_FIELDS[parsed.data.action as StatActionId];

  const player = await prisma.player.findFirst({
    where: { id: parsed.data.playerId, team: { coachId: userId } },
    select: { id: true, primaryPosition: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const updated = await prisma.statLine.upsert({
    where: {
      matchId_playerId: { matchId: params.id, playerId: parsed.data.playerId },
    },
    create: {
      matchId: params.id,
      playerId: parsed.data.playerId,
      positionPlayed: player.primaryPosition,
      [field]: parsed.data.value,
    },
    update: {
      [field]: { increment: parsed.data.value },
    },
  });

  return NextResponse.json(updated);
}
