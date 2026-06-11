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

  // Onboarding stage, judged on the coach's OWN teams (club owners may see
  // others' teams, but their onboarding is about their own).
  const ownTeams = teams.filter((t) => t.coach.id === user.id);
  const ownPlayers = ownTeams.reduce((n, t) => n + t._count.players, 0);
  const ownStatLines =
    ownTeams.length > 0 && ownPlayers > 0
      ? await prisma.statLine.count({
          where: { match: { tournament: { team: { coachId: user.id } } } },
        })
      : 0;
  const onboardingStep =
    ownTeams.length === 0 ? 1 : ownPlayers === 0 ? 2 : ownStatLines === 0 ? 3 : null;
  const firstOwnTeam = ownTeams[ownTeams.length - 1] ?? null;

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

      {onboardingStep !== null && (
        <section className="card mt-8 p-6">
          <h2 className="text-lg font-bold text-slate-100">
            Welcome to SpikeLedger{user.name ? `, ${user.name.split(" ")[0]}` : ""}! 🏐
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Three steps and you&apos;ll have live stats at your next match.
          </p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            <OnboardingStep
              n={1}
              done={onboardingStep > 1}
              active={onboardingStep === 1}
              title="Create your team"
              action={
                onboardingStep === 1 ? (
                  <CreateTeamButton plan={user.plan} currentTeamCount={teams.length} />
                ) : null
              }
            />
            <OnboardingStep
              n={2}
              done={onboardingStep > 2}
              active={onboardingStep === 2}
              title="Add your players"
              action={
                onboardingStep === 2 && firstOwnTeam ? (
                  <Link href={`/team/${firstOwnTeam.id}/roster`} className="btn-primary">
                    Add players
                  </Link>
                ) : null
              }
            />
            <OnboardingStep
              n={3}
              done={false}
              active={onboardingStep === 3}
              title="Enter stats at your next match"
              action={
                onboardingStep === 3 && firstOwnTeam ? (
                  <Link
                    href={`/team/${firstOwnTeam.id}/tournament/new`}
                    className="btn-primary"
                  >
                    Add a tournament
                  </Link>
                ) : null
              }
            />
          </ol>
        </section>
      )}

      <div className="mt-8">
        {teams.length === 0 ? null : (
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

function OnboardingStep({
  n,
  done,
  active,
  title,
  action,
}: {
  n: number;
  done: boolean;
  active: boolean;
  title: string;
  action: React.ReactNode;
}) {
  return (
    <li
      className={`rounded-xl border p-4 ${
        active
          ? "border-volt-400/50 bg-volt-400/5"
          : "border-slate-800 bg-slate-900/50"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            done
              ? "bg-emerald-400 text-emerald-950"
              : active
                ? "bg-volt-400 text-volt-950"
                : "bg-slate-800 text-slate-400"
          }`}
        >
          {done ? "✓" : n}
        </span>
        <span
          className={`text-sm font-semibold ${
            active ? "text-slate-100" : done ? "text-slate-300" : "text-slate-500"
          }`}
        >
          {title}
        </span>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </li>
  );
}
