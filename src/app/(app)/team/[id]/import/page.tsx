import { requireUser } from "@/lib/session";
import { getTeamForCoach } from "@/lib/access";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage({
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
          { label: "Import" },
        ]}
      />

      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight">Import stats</h1>
        <p className="mt-1 text-sm text-slate-400">
          Drop in a CSV or Excel file of past matches. Columns are
          auto-mapped where possible - you confirm before anything saves.
        </p>
      </header>

      <ImportClient teamId={team.id} />
    </div>
  );
}
