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

      <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roster</h1>
          <p className="mt-1 text-sm text-slate-400">
            Add, edit, and deactivate players. Inactive players keep their stat
            history but won&apos;t appear in new match entry.
          </p>
        </div>
      </header>

      <div className="mt-6">
        <RosterClient teamId={team.id} initialPlayers={players} />
      </div>
    </div>
  );
}
