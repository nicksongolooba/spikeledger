import { NextResponse } from "next/server";
import { z } from "zod";
import { Position } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTeamOwnership } from "@/lib/access";
import { invalidateLive } from "@/lib/live-cache";

const PositionEnum = z.nativeEnum(Position);

const UpdatePlayerSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  number: z.number().int().min(0).max(99).nullable().optional(),
  primaryPosition: PositionEnum.optional(),
  secondaryPosition: PositionEnum.nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; pid: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertTeamOwnership(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const player = await prisma.player.findFirst({
    where: { id: params.pid, teamId: params.id },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = UpdatePlayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  if (
    parsed.data.number !== null &&
    parsed.data.number !== undefined &&
    parsed.data.number !== player.number
  ) {
    const dup = await prisma.player.findFirst({
      where: {
        teamId: params.id,
        number: parsed.data.number,
        isActive: true,
        id: { not: params.pid },
      },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: `Jersey number ${parsed.data.number} is already taken on this team.` },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.player.update({
    where: { id: params.pid },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
      ...(parsed.data.number !== undefined && { number: parsed.data.number }),
      ...(parsed.data.primaryPosition !== undefined && {
        primaryPosition: parsed.data.primaryPosition,
      }),
      ...(parsed.data.secondaryPosition !== undefined && {
        secondaryPosition: parsed.data.secondaryPosition,
      }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  });
  invalidateLive({ teamId: params.id });

  return NextResponse.json(updated);
}
