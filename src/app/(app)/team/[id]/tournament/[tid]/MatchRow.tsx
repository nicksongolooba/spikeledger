import Link from "next/link";
import type { Match } from "@prisma/client";
import { cn } from "@/lib/utils";

export function MatchRow({
  match,
  teamId: _teamId,
  tournamentId: _tournamentId,
}: {
  match: Match;
  teamId: string;
  tournamentId: string;
}) {
  const setsLabel =
    match.setsWon > 0 || match.setsLost > 0
      ? `${match.setsWon}-${match.setsLost}`
      : "-";

  let resultLabel = "Pending";
  let resultClass = "bg-slate-800 text-slate-300";
  if (match.result === "WIN") {
    resultLabel = "Win";
    resultClass = "bg-emerald-400/15 text-emerald-300";
  } else if (match.result === "LOSS") {
    resultLabel = "Loss";
    resultClass = "bg-red-400/15 text-red-300";
  } else if (match.result === "DRAW") {
    resultLabel = "Draw";
    resultClass = "bg-amber-400/15 text-amber-300";
  }

  const ctaLabel = match.result ? "Review" : "Enter stats";

  return (
    <Link
      href={`/match/${match.id}/entry`}
      className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-slate-800/40"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 stat-number text-sm font-bold text-slate-300">
          {match.matchNumber}
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-100">
            vs {match.opponent}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Sets {setsLabel}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
            resultClass,
          )}
        >
          {resultLabel}
        </span>
        <span className="hidden text-xs font-medium text-cyan-300 sm:inline">
          {ctaLabel} →
        </span>
      </div>
    </Link>
  );
}
