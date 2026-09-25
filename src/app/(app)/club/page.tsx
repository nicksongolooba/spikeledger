// Club dashboard: identity, coaches, every club team, and club-wide stats.
// CLUB tier only, whether paid directly or lent by an active club; the owner
// additionally gets invite + member management controls.

import Link from "next/link";
import { Volleyball } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureClubForOwner, getClubAccess } from "@/lib/club";
import { EmptyState } from "@/components/ui/EmptyState";
import { InvitePanel } from "./InvitePanel";
import { RemoveMemberButton } from "./RemoveMemberButton";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  COACH: "Coach",
  ASSISTANT: "Assistant",
};

export default async function ClubPage() {
  const user = await requireCoach();
  // Club tier only. A Coach Pro or Free user gets nothing here, and neither
  // does a member whose club has gone dormant.
  const access = await getClubAccess(user.id, user.plan);
  if (!access.allowed) redirect("/dashboard");
  let membership = access.membership;
  if (!membership && user.plan === "CLUB") {
    membership = await ensureClubForOwner(user.id);
  }
  if (!membership) redirect("/dashboard");

  const clubId = membership.club.id;
  const isOwner = membership.role === "OWNER";

  const [members, teams, pendingInvites] = await Promise.all([
    prisma.clubMember.findMany({
      where: { clubId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { role: "asc" }, // OWNER first (enum order)
    }),
    prisma.team.findMany({
      // Private teams with owner oversight: only the OWNER sees the whole
      // club's teams; everyone else sees just their own here.
      where: isOwner ? { clubId } : { clubId, coachId: user.id },
      include: {
        coach: { select: { id: true, name: true } },
        _count: { select: { players: true, tournaments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    isOwner
      ? prisma.clubInvite.findMany({
          where: { clubId, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  // Club-wide stats across all club teams.
  const teamIds = teams.map((t) => t.id);
  const [playerCount, matches] = await Promise.all([
    prisma.player.count({ where: { teamId: { in: teamIds } } }),
    prisma.match.findMany({
      where: { tournament: { teamId: { in: teamIds } } },
      select: { result: true },
    }),
  ]);
  const wins = matches.filter((m) => m.result === "WIN").length;
  const losses = matches.filter((m) => m.result === "LOSS").length;

  return (
    <div>
      {/* Club header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {membership.club.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={membership.club.logo}
              alt={membership.club.name}
              className="h-14 w-14 rounded-lg border border-slate-300 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-navy-900 text-white">
              <Volleyball size={28} strokeWidth={2} aria-hidden />
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">
              {membership.club.name}
            </h1>
            <div className="mt-1 text-sm text-slate-600">
              {membership.club.province && <span>{membership.club.province} · </span>}
              {ROLE_LABEL[membership.role]} view
            </div>
          </div>
        </div>
        {isOwner && (
          <Link href="/club/setup" className="btn-secondary">
            Club settings
          </Link>
        )}
      </header>

      {/* Club-wide stats - owner oversight only */}
      {isOwner && (
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ClubStat label="Coaches" value={members.length.toString()} />
          <ClubStat label="Teams" value={teams.length.toString()} />
          <ClubStat label="Players" value={playerCount.toString()} />
          <ClubStat label="Overall Record" value={`${wins}-${losses}`} accent />
        </section>
      )}

      {/* Coaches */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Coaches</h2>
          <span className="text-xs text-slate-500">{members.length} / 15</span>
        </div>
        <div className="card divide-y divide-slate-200">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">
                  {m.user.name ?? (isOwner ? m.user.email : "Coach")}
                  {m.user.id === user.id && (
                    <span className="ml-2 text-xs text-slate-500">(you)</span>
                  )}
                </div>
                {isOwner && (
                  <div className="truncate text-xs text-slate-500">{m.user.email}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    m.role === "OWNER"
                      ? "rounded-md border border-navy-200 bg-navy-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy-800"
                      : "rounded-md border border-slate-300 bg-slate-100/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                  }
                >
                  {ROLE_LABEL[m.role]}
                </span>
                {isOwner && m.role !== "OWNER" && (
                  <RemoveMemberButton
                    memberId={m.id}
                    name={m.user.name ?? m.user.email}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Invites (owner only) */}
      {isOwner && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold tracking-tight mb-3 text-slate-900">Invite a coach</h2>
          <InvitePanel
            pending={pendingInvites.map((i) => ({
              id: i.id,
              email: i.email,
              code: i.code,
              expiresAt: i.expiresAt.toISOString(),
            }))}
            atCapacity={members.length >= 15}
          />
        </section>
      )}

      {/* Teams across the club */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold tracking-tight mb-3 text-slate-900">
          {isOwner ? "Club teams" : "Your teams"}
        </h2>
        {teams.length === 0 ? (
          <EmptyState
            title={isOwner ? "No club teams yet" : "No teams yet"}
            description={
              isOwner
                ? "Teams created by club coaches appear here automatically."
                : "Teams you create appear here. Other coaches' teams stay private."
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => (
              <Link key={t.id} href={`/team/${t.id}`} className="card card-hover p-4">
                <div className="text-base font-semibold text-slate-900">{t.name}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                  {t.ageGroup && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5">{t.ageGroup}</span>
                  )}
                  <span>
                    Coach: {t.coach.name ?? "Unknown"}
                    {t.coach.id === user.id ? " (you)" : ""}
                  </span>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-slate-500">
                  <span>
                    <span className="stat-number font-bold text-slate-800">
                      {t._count.players}
                    </span>{" "}
                    players
                  </span>
                  <span>
                    <span className="stat-number font-bold text-slate-800">
                      {t._count.tournaments}
                    </span>{" "}
                    tournaments
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ClubStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`stat-number mt-1 text-2xl font-bold ${
          accent ? "text-cyan-700" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
