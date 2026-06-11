// Team access control: private teams with owner oversight. Visibility rule:
// a team is visible to its creating coach, plus the club OWNER for every
// team in their club (oversight). Club COACHes see only their own teams -
// their experience matches Coach Pro exactly. ASSISTANTs will see explicitly
// assigned teams once assignments exist; until then they see only teams they
// created themselves. Write tiers:
//   - "manage" (rosters, tournaments, team settings): creating coach only
//   - "stats" (record/edit stats, scores, lineups): creating coach only for
//     now - reserved for per-team ASSISTANT assignments later
//   - read: the club OWNER

import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Where-clause for every "list/load teams this user can SEE" query.
export function teamVisibleWhere(userId: string): Prisma.TeamWhereInput {
  return {
    OR: [
      { coachId: userId },
      // Owner oversight: OWNERs see every team in their club.
      { club: { is: { members: { some: { userId, role: "OWNER" } } } } },
    ],
  };
}

// READ access (pages, AI, reports). 404s when not visible. Same name and
// signature as before the Club tier so existing call sites keep working -
// callers that need to know whether the viewer can edit should also call
// getTeamAccessLevel.
export async function getTeamForCoach(teamId: string, userId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, ...teamVisibleWhere(userId) },
  });
  if (!team) notFound();
  return team;
}

export type TeamAccessLevel = "manage" | "stats" | "read" | null;

export async function getTeamAccessLevel(
  teamId: string,
  userId: string,
): Promise<TeamAccessLevel> {
  const team = await prisma.team.findFirst({
    where: { id: teamId },
    select: { coachId: true, clubId: true },
  });
  if (!team) return null;
  if (team.coachId === userId) return "manage";
  if (!team.clubId) return null;
  // Only the club OWNER sees other coaches' teams (read-only oversight).
  // COACH members get nothing on teams they didn't create; ASSISTANT access
  // waits on per-team assignments.
  const ownerMembership = await prisma.clubMember.findFirst({
    where: { userId, clubId: team.clubId, role: "OWNER" },
    select: { id: true },
  });
  return ownerMembership ? "read" : null;
}

// WRITE: team management (roster, tournaments, team settings, imports).
// Creating coach only.
export async function assertTeamOwnership(teamId: string, coachId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, coachId },
    select: { id: true },
  });
  return Boolean(team);
}

// WRITE: stat entry (record/undo stats, scores, lineups, match results).
// Creating coach or an ASSISTANT club member.
export async function assertTeamStatsWrite(teamId: string, userId: string) {
  const level = await getTeamAccessLevel(teamId, userId);
  return level === "manage" || level === "stats";
}

// READ: tournament on any visible team.
export async function getTournamentForCoach(tournamentId: string, userId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, team: teamVisibleWhere(userId) },
    include: { team: true },
  });
  if (!tournament) notFound();
  return tournament;
}
