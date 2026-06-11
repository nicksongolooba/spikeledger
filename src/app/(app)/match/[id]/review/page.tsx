import Link from "next/link";
import { notFound } from "next/navigation";
import type { Position } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  calculateBankAccount,
  calculateAggregateBankAccount,
} from "@/engine/bank-account";
import { fmtNum, fmtSigned } from "@/engine/derived-stats";
import { ReviewTable } from "./ReviewTable";
import { BankAccountBars } from "@/components/charts/BankAccountBars";
import { CoachChat } from "@/components/ai/CoachChat";
import { hasFeature, getUpgradeReason } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

export default async function MatchReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const match = await prisma.match.findFirst({
    where: { id: params.id, tournament: { team: { coachId: user.id } } },
    include: { tournament: { include: { team: true } } },
  });
  if (!match) notFound();

  const statLines = await prisma.statLine.findMany({
    where: { matchId: match.id },
    include: { player: true },
  });

  // Team-wide totals
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
  const teamSr = srAtt > 0 ? (sr1 + 2 * sr2 + 3 * sr3) / srAtt : 0;
  const teamBA = calculateAggregateBankAccount(
    statLines,
    statLines[0]?.player.primaryPosition ?? "OH",
  );

  // Per-player rows for the table + chart
  const rows = statLines
    .filter((s) => !s.didNotPlay)
    .map((s) => {
      const positionPlayed = (s.positionPlayed ??
        s.player.primaryPosition) as Position;
      const ba = calculateBankAccount(s, positionPlayed);
      return {
        playerId: s.player.id,
        name: s.player.name,
        number: s.player.number,
        position: positionPlayed,
        primaryPosition: s.player.primaryPosition,
        kills: s.kills,
        attackErrors: s.attackErrors,
        aces: s.aces,
        blocks: s.blocks,
        assists: s.assists,
        digs: s.digs,
        serveErrors: s.serveErrors,
        generalErrors: s.generalErrors,
        srAttempts: s.sr0 + s.sr1 + s.sr2 + s.sr3,
        srAvg:
          s.sr0 + s.sr1 + s.sr2 + s.sr3 > 0
            ? (s.sr1 + 2 * s.sr2 + 3 * s.sr3) /
              (s.sr0 + s.sr1 + s.sr2 + s.sr3)
            : null,
        totalErrors:
          s.serveErrors + s.attackErrors + s.generalErrors + s.blockErrors,
        balance: ba.balance,
        ratio: ba.ratio,
        rating: ba.rating,
        ratingLabel: ba.ratingLabel,
        ratingColor: ba.ratingColor,
      };
    });

  const barData = rows.map((r) => ({
    name: `${r.name}${r.number !== null ? ` #${r.number}` : ""}`,
    balance: r.balance,
    ratio: r.ratio,
    rating: r.rating,
    ratingLabel: r.ratingLabel,
    ratingColor: r.ratingColor,
    position: r.position,
  }));

  const net = totalKills - totalErrors;
  const resultLabel = match.result === "WIN"
    ? "Win"
    : match.result === "LOSS"
      ? "Loss"
      : match.result === "DRAW"
        ? "Draw"
        : "Pending";

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          {
            label: match.tournament.team.name,
            href: `/team/${match.tournament.team.id}`,
          },
          {
            label: match.tournament.name,
            href: `/team/${match.tournament.team.id}/tournament/${match.tournament.id}`,
          },
          { label: `Match ${match.matchNumber} review` },
        ]}
      />

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            vs {match.opponent} - {resultLabel}
          </h1>
          <div className="mt-1 text-sm text-slate-400">
            Match {match.matchNumber} · sets {match.setsWon}-{match.setsLost}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/match/${match.id}/entry`} className="btn-secondary">
            Edit stats
          </Link>
          <Link
            href={`/reports/generate/${match.tournament.team.id}?tournament=${match.tournament.id}`}
            className="btn-secondary"
          >
            Generate report cards
          </Link>
          <Link
            href={`/team/${match.tournament.team.id}/tournament/${match.tournament.id}`}
            className="btn-primary"
          >
            Back to tournament
          </Link>
        </div>
      </header>

      {/* Team summary bar */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <SumTile label="Total Kills" value={totalKills.toString()} accent="emerald" />
        <SumTile label="Total Errors" value={totalErrors.toString()} accent="red" />
        <SumTile
          label="Net Production"
          value={fmtSigned(net)}
          accent={net >= 0 ? "emerald" : "red"}
        />
        <SumTile
          label="Team SR Avg"
          value={srAtt > 0 ? fmtNum(teamSr, 2) : "-"}
          accent="cyan"
        />
        <SumTile
          label="Opponent Errors"
          value={match.opponentErrors.toString()}
          accent="violet"
        />
      </section>
      <p className="mt-2 text-xs text-slate-500">
        {match.opponentErrors} of our points came from opponent mistakes - the
        rest were earned.
      </p>

      <section className="mt-3 card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Team Bank Account
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span
                className="stat-number text-2xl font-bold"
                style={{ color: teamBA.ratingColor }}
              >
                {fmtSigned(teamBA.balance)}
              </span>
              <span
                className="rounded-md border px-2 py-0.5 text-xs font-semibold"
                style={{
                  color: teamBA.ratingColor,
                  borderColor: `${teamBA.ratingColor}55`,
                  backgroundColor: `${teamBA.ratingColor}1a`,
                }}
              >
                {teamBA.ratingLabel}
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            {teamBA.deposits} deposits · {teamBA.withdrawals} withdrawals
            <br />
            {(teamBA.ratio * 100).toFixed(0)}% ratio
          </div>
        </div>
      </section>

      {/* Player table */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Player stats</h2>
        <ReviewTable rows={rows} />
      </section>

      {/* Bank Account leaderboard */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">
          Bank Account leaderboard
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Players grouped by position so comparisons are fair - a libero&apos;s
          number isn&apos;t lined up next to a hitter&apos;s.
        </p>
        <BankAccountBars data={barData} />
      </section>

      {/* Quick actions */}
      <section className="mt-8 card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Quick actions
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/reports/generate/${match.tournament.team.id}?tournament=${match.tournament.id}`}
            className="btn-primary"
          >
            Generate report cards (this tournament)
          </Link>
        </div>
      </section>

      <CoachChat
        teamId={match.tournament.teamId}
        canChat={hasFeature(user.plan, "coachChat")}
        upgradeText={getUpgradeReason(user.plan, "coach-chat").reason}
        contextType="match"
        contextId={match.id}
        contextName={match.opponent}
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
  accent?: "emerald" | "red" | "cyan" | "violet";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "red"
        ? "text-red-300"
        : accent === "cyan"
          ? "text-volt-300"
          : accent === "violet"
            ? "text-violet-300"
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
