import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getTeamParentLinks } from "@/lib/parent";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { TeamSettingsForm } from "./TeamSettingsForm";
import { RevokeParentButton } from "./RevokeParentButton";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage({ params }: { params: { id: string } }) {
  const user = await requireCoach();
  // Settings are for the creating coach only (club owners get read-only pages).
  const team = await prisma.team.findFirst({
    where: { id: params.id, coachId: user.id },
    include: { _count: { select: { players: true } } },
  });
  if (!team) notFound();
  const parentLinks = await getTeamParentLinks(team.id);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: team.name, href: `/team/${team.id}` },
          { label: "Settings" },
        ]}
      />

      <header className="mt-4">
        <div className="eyebrow">{team.name}</div>
        <h1 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
          Team settings
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Name, season, how the team plays, and what parents can see.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <TeamSettingsForm
            team={{
              id: team.id,
              name: team.name,
              ageGroup: team.ageGroup,
              season: team.season,
              usesPositions: team.usesPositions,
              allowParentView: team.allowParentView,
              showBenchStatusToParents: team.showBenchStatusToParents,
              notifyParentsOnStart: team.notifyParentsOnStart,
              playerCount: team._count.players,
            }}
          />
        </div>

        <section className="card self-start lg:col-span-5">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="font-display text-lg font-bold text-slate-900">Linked parents</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Every parent following a player on this team. Hand out codes
              from the roster page.
            </p>
          </div>
          {parentLinks.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              No parents linked yet. Open the roster and tap &ldquo;Parent
              access&rdquo; on a player to create their code.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {parentLinks.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">
                      {l.parent.name ?? "Parent"}{" "}
                      <span className="font-normal text-slate-500">· {l.parent.email}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      follows {l.player.name}
                      {l.player.number !== null ? ` #${l.player.number}` : ""} · since{" "}
                      {formatDate(l.linkedAt)}
                    </div>
                  </div>
                  <RevokeParentButton
                    teamId={team.id}
                    linkId={l.id}
                    parentEmail={l.parent.email}
                    playerName={l.player.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
