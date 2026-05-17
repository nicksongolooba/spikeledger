import { prisma } from "@/lib/prisma";

export async function getCoachedMatch(matchId: string, coachId: string) {
  return prisma.match.findFirst({
    where: { id: matchId, tournament: { team: { coachId } } },
    include: { tournament: { include: { team: true } } },
  });
}

export async function assertCoachOwnsMatch(matchId: string, coachId: string) {
  const m = await prisma.match.findFirst({
    where: { id: matchId, tournament: { team: { coachId } } },
    select: { id: true, tournament: { select: { teamId: true } } },
  });
  return m;
}
