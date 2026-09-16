import { NextResponse } from "next/server";
import { z } from "zod";
import { MatchResult } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCoachOwnsMatch } from "@/lib/match-access";
import { invalidateLive } from "@/lib/live-cache";

const UpdateMatchSchema = z.object({
  setsWon: z.number().int().min(0).max(5).optional(),
  setsLost: z.number().int().min(0).max(5).optional(),
  opponentErrors: z.number().int().min(0).max(500).optional(),
  result: z.nativeEnum(MatchResult).nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertCoachOwnsMatch(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = UpdateMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const updated = await prisma.match.update({
    where: { id: params.id },
    data: parsed.data,
  });
  // Score totals and the result feed the parent view and the team's rally
  // history, so drop both cache entries.
  invalidateLive({ matchId: params.id, teamId: owns.tournament.teamId });

  // A plan downgrade that was held back so it could not interrupt this match
  // is applied now that the match has a result. Never blocks the response.
  if (parsed.data.result) {
    const { flushPendingDowngradesForTeam } = await import("@/lib/billing-sync");
    void flushPendingDowngradesForTeam(owns.tournament.teamId).catch((err) =>
      console.error("[billing] deferred downgrade flush failed:", err),
    );
  }

  return NextResponse.json(updated);
}
