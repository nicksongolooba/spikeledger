import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/plan-limits";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      stripeId: true,
      stripeSubscriptionId: true,
      planExpiresAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Usage snapshot - number of teams, total tournaments, reports generated this month.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  // Report has no FK back to Team; resolve team IDs first.
  const teamIds = (
    await prisma.team.findMany({
      where: { coachId: userId },
      select: { id: true },
    })
  ).map((t) => t.id);

  const [teamCount, tournamentCount, reportsThisMonth] = await Promise.all([
    Promise.resolve(teamIds.length),
    prisma.tournament.count({ where: { team: { coachId: userId } } }),
    prisma.report.count({
      where: {
        teamId: { in: teamIds },
        generatedAt: { gte: monthStart },
      },
    }),
  ]);

  const limits = PLAN_LIMITS[user.plan];

  return NextResponse.json({
    plan: user.plan,
    status: user.stripeSubscriptionId ? "active" : user.plan === "FREE" ? "free" : "active",
    cancelAt: user.planExpiresAt,
    usage: {
      teams: teamCount,
      tournaments: tournamentCount,
      reportsThisMonth,
    },
    limits: {
      maxTeams: Number.isFinite(limits.maxTeams) ? limits.maxTeams : "unlimited",
      maxTournamentsPerTeam: Number.isFinite(limits.maxTournamentsPerTeam)
        ? limits.maxTournamentsPerTeam
        : "unlimited",
      maxReportCardsPerTournament: Number.isFinite(
        limits.maxReportCardsPerTournament,
      )
        ? limits.maxReportCardsPerTournament
        : "unlimited",
      features: limits.features,
    },
  });
}
