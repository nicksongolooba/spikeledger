import { NextResponse } from "next/server";
import { z } from "zod";
import { Position } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTeamOwnership } from "@/lib/access";

const PositionEnum = z.nativeEnum(Position);

const CreatePlayerSchema = z.object({
  name: z.string().min(1).max(80),
  number: z.number().int().min(0).max(99).nullable().optional(),
  primaryPosition: PositionEnum,
  secondaryPosition: PositionEnum.nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertTeamOwnership(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = CreatePlayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  if (parsed.data.number !== null && parsed.data.number !== undefined) {
    const dup = await prisma.player.findFirst({
      where: { teamId: params.id, number: parsed.data.number, isActive: true },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: `Jersey number ${parsed.data.number} is already taken on this team.` },
        { status: 409 },
      );
    }
  }

  const player = await prisma.player.create({
    data: {
      teamId: params.id,
      name: parsed.data.name.trim(),
      number: parsed.data.number ?? null,
      primaryPosition: parsed.data.primaryPosition,
      secondaryPosition: parsed.data.secondaryPosition ?? null,
    },
  });

  return NextResponse.json(player);
}
