import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CreateMatchSchema = z.object({
  opponent: z.string().min(1).max(120),
  matchNumber: z.number().int().min(1).max(99),
});

export async function POST(
  req: Request,
  { params }: { params: { tid: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tournament = await prisma.tournament.findFirst({
    where: { id: params.tid },
    select: { id: true, teamId: true },
  });
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { assertTeamStatsWrite } = await import("@/lib/access");
  if (!(await assertTeamStatsWrite(tournament.teamId, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const dup = await prisma.match.findFirst({
    where: { tournamentId: tournament.id, matchNumber: parsed.data.matchNumber },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json(
      { error: `Match #${parsed.data.matchNumber} already exists in this tournament.` },
      { status: 409 },
    );
  }

  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      opponent: parsed.data.opponent.trim(),
      matchNumber: parsed.data.matchNumber,
    },
  });

  return NextResponse.json(match);
}
