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

  // Enforce plan limit at the API boundary.
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  const teamCount = await prisma.team.count({ where: { coachId: userId } });
  if (me) {
    const { canUserPerformAction } = await import("@/lib/plan-limits");
    const check = canUserPerformAction(me.plan, "add-team", {
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

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name.trim(),
      ageGroup: parsed.data.ageGroup?.trim() || null,
      season: parsed.data.season?.trim() || null,
      coachId: userId,
    },
  });

  return NextResponse.json(team);
}
