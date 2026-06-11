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

  // Enforce per-team tournament limit at the API boundary.
  const { getEffectivePlan } = await import("@/lib/club");
  const plan = await getEffectivePlan(userId);
  const tournamentCount = await prisma.tournament.count({
    where: { teamId: params.id },
  });
  {
    const { canUserPerformAction } = await import("@/lib/plan-limits");
    const check = canUserPerformAction(plan, "add-tournament", {
      currentTournamentCount: tournamentCount,
    });
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: check.reason?.reason ?? "Tournament limit reached.",
          upgradeReason: check.reason,
        },
        { status: 402 },
      );
    }
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

  return NextResponse.json(tournament);
}
