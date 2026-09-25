import Link from "next/link";
import { notFound } from "next/navigation";
import type { Position } from "@prisma/client";
import { ArrowLeft, FileImage, Pencil } from "lucide-react";
import { requireCoach } from "@/lib/session";
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
import { getEffectivePlan } from "@/lib/club";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MatchReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireCoach();
  const effectivePlan = await getEffectivePlan(user.id);
  const { teamVisibleWhere } = await import("@/lib/access");
  const match = await prisma.match.findFirst({
    where: { id: params.id, tournament: { team: teamVisibleWhere(user.id) } },
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
  const usesPositions = match.tournament.team.usesPositions;
  const mode = usesPositions ? "positions" : "universal";
  const teamBA = calculateAggregateBankAccount(
    statLines,
    statLines[0]?.player.primaryPosition ?? "OH",
    mode,
  );

  // Per-player rows for the table + chart
  const rows = statLines
    .filter((s) => !s.didNotPlay)
    .map((s) => {
      const positionPlayed = (s.positionPlayed ??
        s.player.primaryPosition) as Position;
      const ba = calculateBankAccount(s, positionPlayed, mode);
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
  const resultTone =
    match.result === "WIN"
      ? "bg-green-600 text-white"
      : match.result === "LOSS"
        ? "bg-red-600 text-white"
        : match.result === "DRAW"
          ? "bg-amber-600 text-white"
          : "bg-slate-200 text-slate-700";

  const tournamentHref = `/team/${match.tournament.team.id}/tournament/${match.tournament.id}`;
  const reportHref = `/reports/generate/${match.tournament.team.id}?tournament=${match.tournament.id}`;

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
            href: tournamentHref,
          },
          { label: `Match ${match.matchNumber} review` },
        ]}
      />

      <header className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow">
            {match.tournament.name} · Match {match.matchNumber}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
              vs {match.opponent}
            </h1>
            <span
              className={cn(
                "rounded px-2 py-0.5 font-display text-sm font-bold uppercase tracking-wide",
                resultTone,
              )}
            >
              {resultLabel}
            </span>
          </div>
          <div className="mt-2 text-sm text-slate-600">
            Sets{" "}
            <span className="stat-number text-base font-bold text-slate-900">
              {match.setsWon}-{match.setsLost}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={tournamentHref} className="btn-secondary">
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            Back to tournament
          </Link>
          <Link href={`/match/${match.id}/entry`} className="btn-secondary">
            <Pencil size={16} strokeWidth={2} aria-hidden />
            Edit stats
          </Link>
          <Link href={reportHref} className="btn-primary">
            <FileImage size={18} strokeWidth={2} aria-hidden />
            Report cards
          </Link>
        </div>
      </header>

      {/* Team summary: Bank Account featured, totals beside it */}
      <section className="mt-10 grid gap-4 lg:grid-cols-12">
        <article className="card p-5 lg:col-span-4">
          <div className="eyebrow text-slate-500">Team Bank Account</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span
              className="stat-number text-5xl font-bold leading-none"
              style={{ color: teamBA.ratingColor }}
            >
              {fmtSigned(teamBA.balance)}
            </span>
            <span
              className="rounded border px-2 py-0.5 text-xs font-semibold"
              style={{
                color: teamBA.ratingColor,
                borderColor: `${teamBA.ratingColor}55`,
                backgroundColor: `${teamBA.ratingColor}1a`,
              }}
            >
              {teamBA.ratingLabel}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div>
              <dt className="eyebrow text-[10px] text-slate-500">Deposits</dt>
              <dd className="stat-number mt-0.5 text-2xl font-bold leading-none text-green-700">
                {teamBA.deposits}
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-[10px] text-slate-500">Withdrawals</dt>
              <dd className="stat-number mt-0.5 text-2xl font-bold leading-none text-red-700">
                {teamBA.withdrawals}
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-[10px] text-slate-500">Ratio</dt>
              <dd className="stat-number mt-0.5 text-2xl font-bold leading-none text-slate-900">
                {(teamBA.ratio * 100).toFixed(0)}%
              </dd>
            </div>
          </dl>
        </article>

        <div className="lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SumTile label="Kills" value={totalKills.toString()} accent="emerald" />
            <SumTile label="Errors" value={totalErrors.toString()} accent="red" />
            <SumTile
              label="Net production"
              value={fmtSigned(net)}
              accent={net >= 0 ? "emerald" : "red"}
            />
            <SumTile
              label="Team SR avg"
              value={srAtt > 0 ? fmtNum(teamSr, 2) : "-"}
              accent="cyan"
            />
          </div>
          <div className="mt-3 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-5 py-3">
            <div className="stat-number text-3xl font-bold leading-none text-cyan-700">
              {match.opponentErrors}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Opponent errors.</span>{" "}
              {match.opponentErrors} of our points came from their mistakes -
              the rest we earned.
            </div>
          </div>
        </div>
      </section>

      {/* Player table */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Player stats
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {usesPositions
            ? "Click a column to sort. Greyed numbers are stats that position doesn't get judged on."
            : "Click a column to sort. No set positions on this team, so every stat counts for everyone."}
        </p>
        <div className="mt-4">
          <ReviewTable rows={rows} usesPositions={usesPositions} />
        </div>
      </section>

      {/* Bank Account leaderboard */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Bank Account leaderboard
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {usesPositions
            ? "Players grouped by position so comparisons are fair - a libero's number isn't lined up next to a hitter's."
            : "Everyone on the same all-around formula - kills, aces, blocks, assists, digs and good passes are deposits; every error is a withdrawal."}
        </p>
        <div className="mt-4">
          <BankAccountBars data={barData} grouped={usesPositions} />
        </div>
      </section>

      {/* Next step */}
      <section className="mt-10 overflow-hidden rounded-lg bg-navy-900 text-white shadow-card">
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="eyebrow text-cyan-500">Next step</div>
            <h2 className="mt-1 font-display text-2xl font-bold leading-none">
              Turn this tournament into report cards
            </h2>
            <p className="mt-2 text-sm text-navy-200">
              Six images per player, sized for WhatsApp.
            </p>
          </div>
          <Link href={reportHref} className="btn bg-white text-navy-900 hover:bg-navy-50">
            <FileImage size={18} strokeWidth={2} aria-hidden />
            Generate report cards
          </Link>
        </div>
      </section>

      <CoachChat
        teamId={match.tournament.teamId}
        canChat={hasFeature(effectivePlan, "coachChat")}
        upgradeText={getUpgradeReason(effectivePlan, "coach-chat").reason}
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
      ? "text-green-700"
      : accent === "red"
        ? "text-red-700"
        : accent === "cyan"
          ? "text-navy-700"
          : accent === "violet"
            ? "text-cyan-700"
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
