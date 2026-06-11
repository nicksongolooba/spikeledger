import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  ageGroup: z.string().max(20).optional().or(z.literal("")),
  season: z.string().max(20).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Club role check: ASSISTANTs help with stats but don't create teams.
  const { getClubMembership, getEffectivePlan } = await import("@/lib/club");
  const membership = await getClubMembership(userId);
  if (membership?.role === "ASSISTANT") {
    return NextResponse.json(
      { error: "Assistant coaches can't create teams - ask your club owner or a coach." },
      { status: 403 },
    );
  }

  // Enforce plan limit at the API boundary (club members inherit the tier).
  const plan = await getEffectivePlan(userId);
  const teamCount = await prisma.team.count({ where: { coachId: userId } });
  {
    const { canUserPerformAction } = await import("@/lib/plan-limits");
    const check = canUserPerformAction(plan, "add-team", {
      currentTeamCount: teamCount,
    });
    if (!check.allowed) {
      return NextResponse.json(
        {
          error:
            check.reason?.reason ?? "You've reached your team limit on the free plan.",
          upgradeReason: check.reason,
        },
        { status: 402 },
      );
    }
  }

  // Teams created by club members are club-shared automatically.
  const team = await prisma.team.create({
    data: {
      name: parsed.data.name.trim(),
      ageGroup: parsed.data.ageGroup?.trim() || null,
      season: parsed.data.season?.trim() || null,
      coachId: userId,
      clubId: membership?.club.id ?? null,
    },
  });

  return NextResponse.json(team);
}
