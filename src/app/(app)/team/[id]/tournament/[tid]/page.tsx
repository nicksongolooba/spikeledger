import { requireUser } from "@/lib/session";
import { getTeamForCoach } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddMatchButton } from "./AddMatchButton";
import { MatchRow } from "./MatchRow";
import { BankAccountBars } from "@/components/charts/BankAccountBars";
import { BankAccountChip } from "@/components/charts/BankAccountChip";
import { buildPlayerBankAccountBars } from "@/lib/team-analytics";
import { fmtNum, fmtSigned } from "@/engine/derived-stats";
import { TeamIntelligenceCard } from "@/components/ai/TeamIntelligenceCard";
import { CoachChat } from "@/components/ai/CoachChat";
import { hasFeature, getUpgradeReason } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
}: {
  params: { id: string; tid: string };
}) {
  const user = await requireUser();
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

      <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-400">
            <span>{formatDate(tournament.startDate)}</span>
            {tournament.endDate && <span>- {formatDate(tournament.endDate)}</span>}
            {tournament.location && (
              <span className="text-slate-500">· {tournament.location}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="card px-4 py-2 text-right">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Record
            </div>
            <div className="stat-number text-lg font-bold text-slate-100">
              {wins}-{losses}
              {draws > 0 && `-${draws}`}
            </div>
          </div>
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
              Generate report cards
            </Link>
          )}
        </div>
      </header>

      {/* Matches */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Matches</h2>
        {tournament.matches.length === 0 ? (
          <EmptyState
            title="No matches yet"
            description="Add a match to start tracking stats for this tournament."
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
          <div className="card divide-y divide-slate-800">
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

      {/* Summary */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Tournament summary</h2>
        {!hasStats ? (
          <EmptyState
            title="Enter match stats to see tournament analytics"
            description="Once you log stats for at least one match, totals, Bank Account and the best-player tile appear here."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SumTile label="Total Kills" value={totalKills.toString()} accent="emerald" />
              <SumTile label="Total Errors" value={totalErrors.toString()} accent="red" />
              <SumTile
                label="Net Production"
                value={fmtSigned(net)}
                accent={net >= 0 ? "emerald" : "red"}
              />
              <SumTile
                label="Team SR Avg"
                value={srAtt > 0 ? fmtNum(srAvg, 2) : "-"}
                accent="cyan"
              />
            </div>
            {bestPlayer && (
              <div className="mt-3 card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Best Bank Account
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-100">
                    {bestPlayer.player.name}
                    {bestPlayer.player.number !== null && (
                      <span className="ml-2 text-sm text-slate-500">
                        #{bestPlayer.player.number}
                      </span>
                    )}
                  </div>
                </div>
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
            )}
          </>
        )}
      </section>

      {/* Bank Account chart */}
      {bankAccountBars.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">
            Bank Account - this tournament
          </h2>
          <BankAccountBars data={bankAccountBars.map((p) => p.bar)} />
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
        canChat={hasFeature(user.plan, "coachChat")}
        upgradeText={getUpgradeReason(user.plan, "coach-chat").reason}
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
      ? "text-emerald-300"
      : accent === "red"
        ? "text-red-300"
        : accent === "cyan"
          ? "text-cyan-300"
          : "text-slate-100";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`stat-number mt-1 text-2xl font-bold ${accentClass}`}>
        {value}
      </div>
    </div>
  );
}
