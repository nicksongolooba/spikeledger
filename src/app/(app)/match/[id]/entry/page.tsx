import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MatchEntry } from "./MatchEntry";
import { teamHistoricalRallyRate } from "@/lib/win-probability-data";

export const dynamic = "force-dynamic";

export default async function MatchEntryPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const { assertTeamStatsWrite } = await import("@/lib/access");
  const match = await prisma.match.findFirst({
    where: { id: params.id },
    include: {
      tournament: { include: { team: true } },
    },
  });
  if (!match) notFound();
  // Stat entry is a write surface: creating coach or a club ASSISTANT.
  if (!(await assertTeamStatsWrite(match.tournament.teamId, user.id))) {
    notFound();
  }

  const [roster, statLines, historicalRallyRate] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: match.tournament.teamId, isActive: true },
      orderBy: [{ number: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        number: true,
        primaryPosition: true,
        secondaryPosition: true,
      },
    }),
    prisma.statLine.findMany({ where: { matchId: match.id } }),
    teamHistoricalRallyRate(match.tournament.teamId, match.id),
  ]);

  return (
    <MatchEntry
      match={match}
      team={{ id: match.tournament.team.id, name: match.tournament.team.name }}
      tournament={{ id: match.tournament.id, name: match.tournament.name }}
      roster={roster}
      initialStatLines={statLines}
      usesPositions={match.tournament.team.usesPositions}
      historicalRallyRate={historicalRallyRate}
    />
  );
}
