import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { GenerateClient } from "./GenerateClient";
import {
  buildReportCardData,
  cohortFor,
  seasonScope,
  tournamentScope,
} from "@/lib/report-data";

export const dynamic = "force-dynamic";

export default async function GeneratePage({
  params,
  searchParams,
}: {
  params: { teamId: string };
  searchParams?: { tournament?: string; player?: string };
}) {
  const user = await requireCoach();

  const { teamVisibleWhere } = await import("@/lib/access");
  const team = await prisma.team.findFirst({
    where: { id: params.teamId, ...teamVisibleWhere(user.id) },
  });
  if (!team) notFound();

  const [tournaments, players, statLines] = await Promise.all([
    prisma.tournament.findMany({
      where: { teamId: team.id },
      orderBy: { startDate: "desc" },
    }),
    prisma.player.findMany({
      where: { teamId: team.id },
      orderBy: [{ isActive: "desc" }, { number: "asc" }, { name: "asc" }],
    }),
    prisma.statLine.findMany({
      where: { match: { tournament: { teamId: team.id } } },
      include: { match: { select: { id: true, tournamentId: true } } },
    }),
  ]);

  // Pre-compute report card data for every (player, scope) combination once
  // and ship it to the client. That keeps the render side fast - the browser
  // only has to mount + screenshot, no math.
  const scopeOptions = [
    {
      key: "season",
      label: "Full Season",
      tournamentId: null as string | null,
    },
    ...tournaments.map((t) => ({
      key: `tournament:${t.id}`,
      label: t.name,
      tournamentId: t.id,
    })),
  ];

  const linesByPlayer = new Map<string, typeof statLines>();
  for (const sl of statLines) {
    if (!linesByPlayer.has(sl.playerId)) linesByPlayer.set(sl.playerId, []);
    linesByPlayer.get(sl.playerId)!.push(sl);
  }

  const dataByPlayerByScope: Record<
    string,
    Record<string, ReturnType<typeof buildReportCardData>>
  > = {};

  for (const scope of scopeOptions) {
    const scopeDef =
      scope.tournamentId === null
        ? seasonScope()
        : tournamentScope(tournaments.find((t) => t.id === scope.tournamentId)!);
    const scopedLinesByPlayer = new Map<string, typeof statLines>();
    for (const [pid, lines] of linesByPlayer.entries()) {
      const filtered = lines.filter((l) =>
        scopeDef.matchFilter({ tournamentId: l.match.tournamentId }),
      );
      if (filtered.length > 0) scopedLinesByPlayer.set(pid, filtered);
    }
    dataByPlayerByScope[scope.key] = {};
    for (const player of players) {
      const lines = scopedLinesByPlayer.get(player.id) ?? [];
      if (lines.length === 0) continue;
      // Same position group on positions teams; every teammate otherwise.
      const cohort = cohortFor(
        player,
        lines,
        players,
        scopedLinesByPlayer,
        team.usesPositions,
      );

      dataByPlayerByScope[scope.key][player.id] = buildReportCardData({
        team: { id: team.id, name: team.name },
        scopeLabel: scope.label,
        player,
        playerLines: lines,
        cohort,
        usesPositions: team.usesPositions,
      });
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: team.name, href: `/team/${team.id}` },
          { label: "Report cards" },
        ]}
      />

      <header className="mt-4">
        <div className="eyebrow">{team.name}</div>
        <h1 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
          Report cards
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Six images per player, sized for WhatsApp (1080 x 1350). Download
          them one at a time, as a ZIP, or as a single PDF.
        </p>
      </header>

      <div className="mt-8">
        <GenerateClient
          teamName={team.name}
          usesPositions={team.usesPositions}
          scopeOptions={scopeOptions}
          players={players.map((p) => ({
            id: p.id,
            name: p.name,
            number: p.number,
            primaryPosition: p.primaryPosition,
            secondaryPosition: p.secondaryPosition,
            isActive: p.isActive,
          }))}
          dataByPlayerByScope={dataByPlayerByScope}
          defaultScopeKey={
            searchParams?.tournament
              ? `tournament:${searchParams.tournament}`
              : "season"
          }
          preselectedPlayerId={searchParams?.player}
        />
      </div>
    </div>
  );
}
