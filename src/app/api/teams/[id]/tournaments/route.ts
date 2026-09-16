import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTeamOwnership } from "@/lib/access";

const CreateTournamentSchema = z.object({
  name: z.string().min(1).max(120),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  location: z.string().max(120).nullable().optional(),
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
  const parsed = CreateTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const startDate = new Date(parsed.data.startDate);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
  }
  let endDate: Date | null = null;
  if (parsed.data.endDate) {
    endDate = new Date(parsed.data.endDate);
    if (Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid end date." }, { status: 400 });
    }
  }

  // The free-tier limit is enforced here, at a laptop, and nowhere near the
  // courtside screen. See src/lib/courtside-grace.ts for the whole rule.
  const { getEffectivePlan } = await import("@/lib/club");
  const { decideTournamentCreation, recordGraceTournament, GRACE_TOURNAMENT_BANNER } =
    await import("@/lib/courtside-grace");
  const plan = await getEffectivePlan(userId);
  const decision = await decideTournamentCreation(userId, params.id, plan);
  if (!decision.allow) {
    return NextResponse.json(
      {
        error: decision.reason?.reason ?? "Tournament limit reached.",
        upgradeReason: decision.reason,
      },
      { status: 402 },
    );
  }

  const tournament = await prisma.tournament.create({
    data: {
      teamId: params.id,
      name: parsed.data.name.trim(),
      startDate,
      endDate,
      location: parsed.data.location?.trim() || null,
    },
  });

  // Only recorded once the tournament exists, so a failed create never burns
  // the coach's one courtesy.
  if (decision.grace) await recordGraceTournament(userId, tournament.id);

  return NextResponse.json({
    ...tournament,
    notice: decision.grace ? GRACE_TOURNAMENT_BANNER : decision.notice,
    grace: decision.grace,
  });
}
