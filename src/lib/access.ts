import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function getTeamForCoach(teamId: string, coachId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, coachId },
  });
  if (!team) notFound();
  return team;
}

export async function assertTeamOwnership(teamId: string, coachId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, coachId },
    select: { id: true },
  });
  return Boolean(team);
}

export async function getTournamentForCoach(tournamentId: string, coachId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, team: { coachId } },
    include: { team: true },
  });
  if (!tournament) notFound();
  return tournament;
}
