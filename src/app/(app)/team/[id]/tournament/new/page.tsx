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
          { label: "New tournament" },
        ]}
      />

      <header className="mt-4">
        <div className="eyebrow">{team.name}</div>
        <h1 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
          New tournament
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Name the event and set the dates. Matches and stats get added once it
          exists.
        </p>
      </header>

      <div className="mt-8 max-w-xl">
        <NewTournamentForm teamId={team.id} />
      </div>
    </div>
  );
}
