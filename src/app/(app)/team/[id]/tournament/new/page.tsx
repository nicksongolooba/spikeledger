import { requireUser } from "@/lib/session";
import { getTeamForCoach } from "@/lib/access";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NewTournamentForm } from "./NewTournamentForm";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const team = await getTeamForCoach(params.id, user.id);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: team.name, href: `/team/${team.id}` },
          { label: "New Tournament" },
        ]}
      />

      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight">Create tournament</h1>
        <p className="mt-1 text-sm text-slate-400">
          Add a competition for {team.name}. You can log matches once the
          tournament is created.
        </p>
      </header>

      <div className="mt-6 max-w-xl">
        <NewTournamentForm teamId={team.id} />
      </div>
    </div>
  );
}
