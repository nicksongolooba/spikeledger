import { requireCoach } from "@/lib/session";
import { getTeamForCoach } from "@/lib/access";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireCoach();
  const team = await getTeamForCoach(params.id, user.id);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: team.name, href: `/team/${team.id}` },
          { label: "Import" },
        ]}
      />

      <header className="mt-4">
        <div className="eyebrow">{team.name}</div>
        <h1 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
          Import stats
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Bring in a CSV or Excel export of past matches. We match the columns
          where we can, and nothing saves until you confirm.
        </p>
      </header>

      <ImportClient teamId={team.id} />
    </div>
  );
}
