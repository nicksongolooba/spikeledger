import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getTeamForCoach } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RosterClient } from "./RosterClient";

export const dynamic = "force-dynamic";

export default async function RosterPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { assignPositions?: string };
}) {
  const user = await requireUser();
  const team = await getTeamForCoach(params.id, user.id);
  const players = await prisma.player.findMany({
    where: { teamId: team.id },
    orderBy: [{ isActive: "desc" }, { number: "asc" }, { name: "asc" }],
    include: {
      parentLinks: {
        orderBy: { linkedAt: "asc" },
        include: { parent: { select: { name: true, email: true } } },
      },
    },
  });
  const assignPositions = searchParams?.assignPositions === "1" && team.usesPositions;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: team.name, href: `/team/${team.id}` },
          { label: "Roster" },
        ]}
      />

      <header className="mt-4">
        <div className="eyebrow">{team.name}</div>
        <h1 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
          Roster
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          {team.usesPositions
            ? "Add, edit and deactivate players, and hand parents their access codes. Inactive players keep their stat history but won't show up in match entry."
            : "This team plays without set positions, so players are just players. Add, edit and deactivate them here, and hand parents their access codes."}
        </p>
      </header>

      {assignPositions && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <div className="font-semibold">This team now uses set positions.</div>
            <div className="mt-0.5">
              Give each player a position - tap Edit on anyone still showing
              as Utility. You can change it any time from{" "}
              <Link href={`/team/${team.id}/settings`} className="font-semibold underline">
                team settings
              </Link>
              .
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <RosterClient
          teamId={team.id}
          usesPositions={team.usesPositions}
          initialPlayers={players.map((p) => ({
            id: p.id,
            name: p.name,
            number: p.number,
            primaryPosition: p.primaryPosition,
            secondaryPosition: p.secondaryPosition,
            isActive: p.isActive,
            parentCode: p.parentCode,
            parentLinks: p.parentLinks.map((l) => ({
              id: l.id,
              linkedAt: l.linkedAt.toISOString(),
              parentName: l.parent.name,
              parentEmail: l.parent.email,
            })),
          }))}
        />
      </div>
    </div>
  );
}
