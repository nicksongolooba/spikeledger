// Match-level access, club-aware (see access.ts for the tiers).

import { prisma } from "@/lib/prisma";
import { teamVisibleWhere, assertTeamStatsWrite } from "@/lib/access";

// READ: match on any team visible to this user (own or club).
export async function getCoachedMatch(matchId: string, userId: string) {
  return prisma.match.findFirst({
    where: { id: matchId, tournament: { team: teamVisibleWhere(userId) } },
    include: { tournament: { include: { team: true } } },
  });
}

// WRITE (stat entry): creating coach or ASSISTANT club member. Name kept
// from the pre-club API so existing stat-entry routes keep working.
export async function assertCoachOwnsMatch(matchId: string, userId: string) {
  const m = await prisma.match.findFirst({
    where: { id: matchId },
    select: { id: true, tournament: { select: { teamId: true } } },
  });
  if (!m) return null;
  const ok = await assertTeamStatsWrite(m.tournament.teamId, userId);
  return ok ? m : null;
}
