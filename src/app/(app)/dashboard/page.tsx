import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { teamVisibleWhere } from "@/lib/access";
import { ensureClubForOwner } from "@/lib/club";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateTeamButton } from "./CreateTeamButton";
import { formatDate, pluralize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  // Club owners get their club auto-created on first visit after checkout.
  const membership = user.plan === "CLUB" ? await ensureClubForOwner(user.id) : null;
  const teams = await prisma.team.findMany({
    where: teamVisibleWhere(user.id),
    orderBy: { createdAt: "desc" },
    include: {
      coach: { select: { id: true, name: true } },
      _count: { select: { players: true, tournaments: true } },
      tournaments: {
        orderBy: { startDate: "desc" },
        take: 1,
        select: { startDate: true, name: true },
      },
    },
  });

  return (
    <div>
      {membership && membership.club.name.endsWith("'s Club") && (
        <Link
          href="/club/setup"
          className="mb-6 flex items-center justify-between rounded-xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm text-gold-200 hover:bg-gold-400/15"
        >
          <span>
            <span className="font-bold">Finish setting up your club</span> - name
            it and start inviting coaches.
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Teams</h1>
          <p className="mt-1 text-sm text-slate-400">
            Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}. Pick a
            team to keep working, or spin up a new one.
          </p>
        </div>
        <CreateTeamButton plan={user.plan} currentTeamCount={teams.length} />
      </div>

      <div className="mt-8">
        {teams.length === 0 ? (
          <EmptyState
            title="Create your first team to get started"
            description="A team holds your roster, tournaments, and stats. You can always add more later."
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-12 w-12"
              >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            }
            action={
              <CreateTeamButton
                variant="prominent"
                plan={user.plan}
                currentTeamCount={teams.length}
              />
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const lastTournament = team.tournaments[0];
              return (
                <Link
                  key={team.id}
                  href={`/team/${team.id}`}
                  className="card card-hover group p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100 group-hover:text-volt-300">
                        {team.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                        {team.ageGroup && (
                          <span className="rounded-md bg-slate-800 px-1.5 py-0.5">
                            {team.ageGroup}
                          </span>
                        )}
                        {team.season && <span>{team.season}</span>}
                        {team.coach.id !== user.id && (
                          <span className="rounded-md border border-gold-400/30 bg-gold-400/10 px-1.5 py-0.5 text-gold-200">
                            {team.coach.name ?? "Club coach"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Players
                      </dt>
                      <dd className="stat-number mt-0.5 text-xl font-bold text-slate-100">
                        {team._count.players}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        {pluralize(team._count.tournaments, "Tournament")}
                      </dt>
                      <dd className="stat-number mt-0.5 text-xl font-bold text-slate-100">
                        {team._count.tournaments}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 border-t border-slate-800 pt-3 text-xs text-slate-500">
                    {lastTournament
                      ? `Last activity: ${lastTournament.name} · ${formatDate(lastTournament.startDate)}`
                      : `Created ${formatDate(team.createdAt)}`}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
