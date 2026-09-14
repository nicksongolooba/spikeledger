import { requireUser } from "@/lib/session";
import { getTeamForCoach } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatDate, pluralize } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, FileImage, MapPin, Trophy } from "lucide-react";
import { AddMatchButton } from "./AddMatchButton";
import { MatchRow } from "./MatchRow";
import { BankAccountBars } from "@/components/charts/BankAccountBars";
import { BankAccountChip } from "@/components/charts/BankAccountChip";
import { buildPlayerBankAccountBars } from "@/lib/team-analytics";
import { fmtNum, fmtSigned } from "@/engine/derived-stats";
import { TeamIntelligenceCard } from "@/components/ai/TeamIntelligenceCard";
import { CoachChat } from "@/components/ai/CoachChat";
import { hasFeature, getUpgradeReason } from "@/lib/plan-limits";
import { getEffectivePlan } from "@/lib/club";

export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
}: {
  params: { id: string; tid: string };
}) {
  const user = await requireUser();
  const effectivePlan = await getEffectivePlan(user.id);
  const team = await getTeamForCoach(params.id, user.id);
  const tournament = await prisma.tournament.findFirst({
    where: { id: params.tid, teamId: team.id },
    include: { matches: { orderBy: { matchNumber: "asc" } } },
  });
  if (!tournament) notFound();

  const [players, statLines] = await Promise.all([
    prisma.player.findMany({ where: { teamId: team.id } }),
    prisma.statLine.findMany({
      where: { match: { tournamentId: tournament.id } },
    }),
  ]);

  // Aggregate counters
  let totalKills = 0;
  let totalErrors = 0;
  let sr0 = 0,
    sr1 = 0,
    sr2 = 0,
    sr3 = 0;
  for (const s of statLines) {
    if (s.didNotPlay) continue;
    totalKills += s.kills;
    totalErrors +=
      s.serveErrors + s.attackErrors + s.generalErrors + s.blockErrors;
    sr0 += s.sr0;
    sr1 += s.sr1;
    sr2 += s.sr2;
    sr3 += s.sr3;
  }
  const srAtt = sr0 + sr1 + sr2 + sr3;
  const srAvg = srAtt > 0 ? (sr1 + 2 * sr2 + 3 * sr3) / srAtt : 0;
  const net = totalKills - totalErrors;
  const hasStats = statLines.length > 0;

  const wins = tournament.matches.filter((m) => m.result === "WIN").length;
  const losses = tournament.matches.filter((m) => m.result === "LOSS").length;
  const draws = tournament.matches.filter((m) => m.result === "DRAW").length;
  const record = `${wins}-${losses}${draws > 0 ? `-${draws}` : ""}`;

  const nextMatchNumber =
    tournament.matches.reduce((max, m) => Math.max(max, m.matchNumber), 0) + 1;

  // Bank Account per player, scoped to this tournament.
  const bankAccountBars = buildPlayerBankAccountBars(players, statLines);
  const bestPlayer =
    bankAccountBars.length > 0
      ? [...bankAccountBars].sort(
          (a, b) => b.bar.balance - a.bar.balance,
        )[0]
      : null;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: team.name, href: `/team/${team.id}` },
          { label: tournament.name },
        ]}
      />

      <header className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow">{team.name}</div>
          <h1 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
            {tournament.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Calendar
                size={15}
                strokeWidth={2}
                className="text-slate-400"
                aria-hidden
              />
              {formatDate(tournament.startDate)}
              {tournament.endDate && <> - {formatDate(tournament.endDate)}</>}
            </span>
            {tournament.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin
                  size={15}
                  strokeWidth={2}
                  className="text-slate-400"
                  aria-hidden
                />
                {tournament.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg bg-navy-900 px-5 py-3 text-white shadow-card">
            <div className="eyebrow text-cyan-500">Record</div>
            <div className="stat-number mt-0.5 text-3xl font-bold leading-none">
              {record}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddMatchButton
              teamId={team.id}
              tournamentId={tournament.id}
              nextMatchNumber={nextMatchNumber}
            />
            {statLines.length > 0 && (
              <Link
                href={`/reports/generate/${team.id}?tournament=${tournament.id}`}
                className="btn-secondary"
              >
                <FileImage size={16} strokeWidth={2} aria-hidden />
                Report cards
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Matches */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Matches
          </h2>
          {tournament.matches.length > 0 && (
            <span className="text-sm text-slate-500">
              {tournament.matches.length}{" "}
              {pluralize(tournament.matches.length, "match", "matches")}
            </span>
          )}
        </div>
        {tournament.matches.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No matches yet"
            description="Add the first match and start entering stats."
            action={
              <AddMatchButton
                teamId={team.id}
                tournamentId={tournament.id}
                nextMatchNumber={1}
                variant="prominent"
              />
            }
          />
        ) : (
          <div className="card mt-4 divide-y divide-slate-100 overflow-hidden">
            {tournament.matches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                teamId={team.id}
                tournamentId={tournament.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Summary: four tiles beside the top-player card */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Tournament summary
        </h2>
        {!hasStats ? (
          <EmptyState
            className="mt-4"
            title="Enter match stats to see the tournament picture"
            description="Log stats for one match and the totals, Bank Account and top player show up here."
          />
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <div
              className={cn(
                "grid grid-cols-2 gap-3",
                bestPlayer ? "lg:col-span-8" : "sm:grid-cols-4 lg:col-span-12",
              )}
            >
              <SumTile label="Kills" value={totalKills.toString()} accent="emerald" />
              <SumTile label="Errors" value={totalErrors.toString()} accent="red" />
              <SumTile
                label="Net production"
                value={fmtSigned(net)}
                accent={net >= 0 ? "emerald" : "red"}
              />
              <SumTile
                label="Team SR avg"
                value={srAtt > 0 ? fmtNum(srAvg, 2) : "-"}
                accent="cyan"
              />
            </div>
            {bestPlayer && (
              <article className="card overflow-hidden lg:col-span-4">
                <div className="flex items-center gap-2 bg-navy-900 px-5 py-3 text-white">
                  <Trophy
                    size={16}
                    strokeWidth={2}
                    className="text-cyan-500"
                    aria-hidden
                  />
                  <span className="eyebrow text-cyan-500">Best Bank Account</span>
                </div>
                <div className="p-5">
                  <div className="font-display text-2xl font-bold leading-none text-slate-900">
                    {bestPlayer.player.name}
                  </div>
                  {bestPlayer.player.number !== null && (
                    <div className="mt-1 text-sm text-slate-500">
                      #{bestPlayer.player.number}
                    </div>
                  )}
                  <div className="mt-4">
                    <BankAccountChip
                      result={{
                        balance: bestPlayer.bar.balance,
                        deposits: 0,
                        withdrawals: 0,
                        ratio: bestPlayer.bar.ratio,
                        rating: bestPlayer.bar.rating as
                          | "GREEN"
                          | "BLUE"
                          | "ORANGE"
                          | "RED"
                          | "GREY",
                        ratingLabel: bestPlayer.bar.ratingLabel,
                        ratingColor: bestPlayer.bar.ratingColor,
                        depositBreakdown: {},
                        withdrawalBreakdown: {},
                        positionGroup: null,
                      }}
                    />
                  </div>
                </div>
              </article>
            )}
          </div>
        )}
      </section>

      {/* Bank Account chart */}
      {bankAccountBars.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Bank Account - this tournament
          </h2>
          <div className="mt-4">
            <BankAccountBars data={bankAccountBars.map((p) => p.bar)} />
          </div>
        </section>
      )}

      {/* AI team intelligence (tournament-scoped) */}
      {hasStats && (
        <div className="mt-10">
          <TeamIntelligenceCard
            teamId={team.id}
            scope="tournament"
            scopeId={tournament.id}
            title="AI Coach Analysis - this tournament"
          />
        </div>
      )}

      <CoachChat
        teamId={team.id}
        canChat={hasFeature(effectivePlan, "coachChat")}
        upgradeText={getUpgradeReason(effectivePlan, "coach-chat").reason}
        contextType="tournament"
        contextId={tournament.id}
        contextName={tournament.name}
      />
    </div>
  );
}

function SumTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "red" | "cyan";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-green-700"
      : accent === "red"
        ? "text-red-700"
        : accent === "cyan"
          ? "text-navy-700"
          : "text-slate-900";
  return (
    <div className="card p-5">
      <div className="eyebrow text-slate-500">{label}</div>
      <div
        className={cn(
          "stat-number mt-2 text-4xl font-bold leading-none",
          accentClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}
