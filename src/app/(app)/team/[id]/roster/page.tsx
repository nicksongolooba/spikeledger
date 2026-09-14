import { requireUser } from "@/lib/session";
import { getTeamForCoach } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RosterClient } from "./RosterClient";

export const dynamic = "force-dynamic";

export default async function RosterPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const team = await getTeamForCoach(params.id, user.id);
  const players = await prisma.player.findMany({
    where: { teamId: team.id },
    orderBy: [{ isActive: "desc" }, { number: "asc" }, { name: "asc" }],
  });

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
          Add, edit and deactivate players. Inactive players keep their stat
          history but won&apos;t show up in match entry.
        </p>
      </header>

      <div className="mt-8">
        <RosterClient teamId={team.id} initialPlayers={players} />
      </div>
    </div>
  );
}
