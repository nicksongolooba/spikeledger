import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  ClipboardList,
  FileImage,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { teamVisibleWhere } from "@/lib/access";
import { ensureClubForOwner } from "@/lib/club";
import { CreateTeamButton } from "./CreateTeamButton";
import { cn, formatDate } from "@/lib/utils";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  // Club owners get their club auto-created on first visit after checkout.
  const membership = user.plan === "CLUB" ? await ensureClubForOwner(user.id) : null;
  const visible = teamVisibleWhere(user.id);

  const [teamsRaw, recentMatches] = await Promise.all([
    prisma.team.findMany({
      where: visible,
      orderBy: { createdAt: "desc" },
      include: {
        coach: { select: { id: true, name: true } },
        _count: { select: { players: true, tournaments: true } },
        tournaments: {
          orderBy: { startDate: "desc" },
          select: {
            id: true,
            name: true,
            startDate: true,
            _count: { select: { matches: true } },
          },
        },
      },
    }),
    prisma.match.findMany({
      where: { tournament: { team: visible } },
      orderBy: [{ tournament: { startDate: "desc" } }, { matchNumber: "desc" }],
      take: 6,
      select: {
        id: true,
        opponent: true,
        result: true,
        setsWon: true,
        setsLost: true,
        tournament: {
          select: {
            name: true,
            startDate: true,
            team: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  // The team with the most recent tournament leads the page; the rest follow
  // as smaller cards. Newest-created wins ties so a brand-new team surfaces.
  const teams = [...teamsRaw].sort((a, b) => {
    const la = a.tournaments[0]?.startDate.getTime() ?? 0;
    const lb = b.tournaments[0]?.startDate.getTime() ?? 0;
    return lb - la || b.createdAt.getTime() - a.createdAt.getTime();
  });
  const matchCount = (t: (typeof teams)[number]) =>
    t.tournaments.reduce((n, x) => n + x._count.matches, 0);
  const [featured, ...rest] = teams;
  const totals = teams.reduce(
    (acc, t) => ({
      players: acc.players + t._count.players,
      tournaments: acc.tournaments + t._count.tournaments,
      matches: acc.matches + matchCount(t),
    }),
    { players: 0, tournaments: 0, matches: 0 },
  );
  const seasons = new Set(teams.map((t) => t.season).filter(Boolean));
  const seasonLabel =
    seasons.size === 1 ? `${[...seasons][0]} season` : "Your season";

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
  const firstName = user.name ? user.name.split(" ")[0] : null;

  return (
    <div>
      {membership && membership.club.name.endsWith("'s Club") && (
        <Link
          href="/club/setup"
          className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 hover:bg-cyan-100"
        >
          <span>
            <span className="font-bold">Finish setting up your club</span> - name
            it and start inviting coaches.
          </span>
          <ArrowRight size={16} strokeWidth={2} aria-hidden />
        </Link>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">{seasonLabel}</div>
          <h1 className="mt-1 font-display text-4xl font-bold leading-none tracking-tight text-slate-900 sm:text-5xl">
            Your teams
          </h1>
          <p className="mt-3 max-w-xl text-slate-600">
            Welcome back{firstName ? `, ${firstName}` : ""}. Pick up where you
            left off, or set up the next team.
          </p>
        </div>
        <CreateTeamButton plan={user.plan} currentTeamCount={teams.length} />
      </header>

      {onboardingStep !== null && (
        <section className="card mt-8 p-6">
          <div className="eyebrow">Getting started</div>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
            Three steps to live stats at your next match
          </h2>
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

      {featured && (
        <section className="mt-8 grid gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            <FeaturedTeam
              team={featured}
              matches={matchCount(featured)}
              mine={featured.coach.id === user.id}
            />
            {rest.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {rest.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    matches={matchCount(team)}
                    mine={team.coach.id === user.id}
                  />
                ))}
              </div>
            )}
          </div>
          <aside className="space-y-5 lg:col-span-4">
            {teams.length > 1 && <SeasonStrip totals={totals} teams={teams.length} />}
            <RecentMatches matches={recentMatches} />
          </aside>
        </section>
      )}
      <InstallPrompt />
    </div>
  );
}

type TeamRow = {
  id: string;
  name: string;
  ageGroup: string | null;
  season: string | null;
  createdAt: Date;
  coach: { id: string; name: string | null };
  _count: { players: number; tournaments: number };
  tournaments: { id: string; name: string; startDate: Date }[];
};

function FeaturedTeam({
  team,
  matches,
  mine,
}: {
  team: TeamRow;
  matches: number;
  mine: boolean;
}) {
  const last = team.tournaments[0];
  return (
    <article className="card overflow-hidden">
      <div className="bg-navy-900 px-6 py-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow text-cyan-500">
              {last ? "Most recent activity" : "Newest team"}
            </div>
            <h2 className="mt-1 font-display text-3xl font-bold leading-none sm:text-4xl">
              {team.name}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-navy-200">
              {team.ageGroup && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-white">
                  {team.ageGroup}
                </span>
              )}
              {team.season && <span>{team.season}</span>}
              {!mine && (
                <span className="rounded border border-white/20 px-1.5 py-0.5 text-xs">
                  {team.coach.name ?? "Club coach"}
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/team/${team.id}`}
            className="btn bg-white text-navy-900 hover:bg-navy-50"
          >
            Open team
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200">
        <BigStat label="Players" value={team._count.players} />
        <BigStat label="Tournaments" value={team._count.tournaments} />
        <BigStat label="Matches" value={matches} />
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Calendar size={15} strokeWidth={2} aria-hidden />
          {last
            ? `${last.name} · ${formatDate(last.startDate)}`
            : `Created ${formatDate(team.createdAt)}`}
        </div>
        {mine && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/team/${team.id}/roster`} className="btn-secondary">
              <Users size={16} strokeWidth={2} aria-hidden />
              Roster
            </Link>
            {last ? (
              <Link
                href={`/team/${team.id}/tournament/${last.id}`}
                className="btn-secondary"
              >
                <ClipboardList size={16} strokeWidth={2} aria-hidden />
                Latest tournament
              </Link>
            ) : (
              <Link href={`/team/${team.id}/tournament/new`} className="btn-secondary">
                <ClipboardList size={16} strokeWidth={2} aria-hidden />
                Add a tournament
              </Link>
            )}
            {matches > 0 && (
              <Link href={`/reports/generate/${team.id}`} className="btn-navy">
                <FileImage size={16} strokeWidth={2} aria-hidden />
                Report cards
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-6 py-4">
      <dt className="eyebrow text-slate-500">{label}</dt>
      <dd className="stat-number mt-1 text-4xl font-bold leading-none text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function TeamCard({
  team,
  matches,
  mine,
}: {
  team: TeamRow;
  matches: number;
  mine: boolean;
}) {
  const last = team.tournaments[0];
  return (
    <Link href={`/team/${team.id}`} className="card card-hover group flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-bold text-slate-900 group-hover:text-cyan-700">
            {team.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {team.ageGroup && <span className="chip">{team.ageGroup}</span>}
            {team.season && <span>{team.season}</span>}
            {!mine && (
              <span className="rounded border border-navy-200 bg-navy-50 px-1.5 py-0.5 text-navy-800">
                {team.coach.name ?? "Club coach"}
              </span>
            )}
          </div>
        </div>
        <ArrowRight
          size={18}
          strokeWidth={2}
          className="shrink-0 text-slate-300 transition-colors group-hover:text-cyan-600"
          aria-hidden
        />
      </div>
      <dl className="mt-5 flex gap-6">
        <SmallStat label="Players" value={team._count.players} />
        <SmallStat label="Tourn." value={team._count.tournaments} />
        <SmallStat label="Matches" value={matches} />
      </dl>
      <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {last
          ? `${last.name} · ${formatDate(last.startDate)}`
          : `Created ${formatDate(team.createdAt)}`}
      </div>
    </Link>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="eyebrow text-[10px] text-slate-500">{label}</dt>
      <dd className="stat-number mt-0.5 text-2xl font-bold leading-none text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function SeasonStrip({
  totals,
  teams,
}: {
  totals: { players: number; tournaments: number; matches: number };
  teams: number;
}) {
  return (
    <section className="card p-5">
      <div className="eyebrow">Across {teams} teams</div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <SmallStat label="Players" value={totals.players} />
        <SmallStat label="Tourn." value={totals.tournaments} />
        <SmallStat label="Matches" value={totals.matches} />
      </dl>
    </section>
  );
}

function RecentMatches({
  matches,
}: {
  matches: {
    id: string;
    opponent: string;
    result: string | null;
    setsWon: number;
    setsLost: number;
    tournament: { name: string; startDate: Date; team: { name: string } };
  }[];
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Recent matches
        </h2>
        {matches.length > 0 && (
          <span className="text-xs text-slate-500">Last {matches.length}</span>
        )}
      </div>
      {matches.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          Nothing logged yet. Your first match shows up here the moment you
          start entering stats.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {matches.map((m) => {
            const tone =
              m.result === "WIN"
                ? "bg-green-50 text-green-700"
                : m.result === "LOSS"
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-100 text-slate-600";
            const letter = m.result === "WIN" ? "W" : m.result === "LOSS" ? "L" : "-";
            return (
              <li key={m.id}>
                <Link
                  href={`/match/${m.id}/review`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                >
                  <span
                    className={cn(
                      "stat-number flex h-9 w-9 shrink-0 items-center justify-center rounded text-lg font-bold",
                      tone,
                    )}
                  >
                    {letter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      vs {m.opponent}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {m.tournament.team.name} · {m.tournament.name}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="stat-number text-lg font-bold leading-none text-slate-900">
                      {m.setsWon}-{m.setsLost}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {formatDate(m.tournament.startDate)}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
      className={cn(
        "rounded-lg border p-4",
        active ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "stat-number flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold",
            done
              ? "bg-green-600 text-white"
              : active
                ? "bg-cyan-500 text-navy-950"
                : "bg-slate-200 text-slate-600",
          )}
        >
          {done ? <Check size={16} strokeWidth={2.5} aria-label="Done" /> : n}
        </span>
        <span
          className={cn(
            "font-semibold",
            active ? "text-slate-900" : done ? "text-slate-700" : "text-slate-500",
          )}
        >
          {title}
        </span>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </li>
  );
}
