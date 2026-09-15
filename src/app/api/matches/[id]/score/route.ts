import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCoachOwnsMatch } from "@/lib/match-access";
import { invalidateLive } from "@/lib/live-cache";

// Two payloads share this route:
//   - the match total { setsWon, setsLost } (kept for older clients), and
//   - a live per-set score { setNumber, us, them, history } that the
//     courtside page sends after every point so the parent view and the set
//     win probability can follow along. Absolute values, so resends after a
//     dropped connection are harmless.
const Point = z.tuple([z.number().int().min(0).max(60), z.number().int().min(0).max(60)]);
const LiveSetSchema = z.object({
  setNumber: z.number().int().min(1).max(5),
  us: z.number().int().min(0).max(60),
  them: z.number().int().min(0).max(60),
  history: z.array(Point).max(150).default([]),
});
const TotalsSchema = z.object({
  setsWon: z.number().int().min(0).max(5),
  setsLost: z.number().int().min(0).max(5),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertCoachOwnsMatch(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);

  const live = LiveSetSchema.safeParse(body);
  if (live.success) {
    const { setNumber, us, them, history } = live.data;
    const row = await prisma.matchSetScore.upsert({
      where: { matchId_setNumber: { matchId: params.id, setNumber } },
      create: { matchId: params.id, setNumber, us, them, history },
      update: { us, them, history },
    });
    invalidateLive({ matchId: params.id });
    return NextResponse.json(row);
  }

  const totals = TotalsSchema.safeParse(body);
  if (!totals.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const updated = await prisma.match.update({
    where: { id: params.id },
    data: { setsWon: totals.data.setsWon, setsLost: totals.data.setsLost },
  });
  invalidateLive({ matchId: params.id, teamId: owns.tournament.teamId });
  return NextResponse.json(updated);
}
