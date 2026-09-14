import Link from "next/link";
import type { Match } from "@prisma/client";
import { ArrowRight } from "lucide-react";
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
  let resultClass = "bg-slate-100 text-slate-600";
  if (match.result === "WIN") {
    resultLabel = "Win";
    resultClass = "bg-emerald-50 text-emerald-700";
  } else if (match.result === "LOSS") {
    resultLabel = "Loss";
    resultClass = "bg-red-50 text-red-700";
  } else if (match.result === "DRAW") {
    resultLabel = "Draw";
    resultClass = "bg-amber-50 text-amber-700";
  }

  const ctaLabel = match.result ? "Review" : "Enter stats";

  return (
    <Link
      href={`/match/${match.id}/entry`}
      className="group flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="stat-number flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-base font-bold text-slate-700">
          {match.matchNumber}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900 transition-colors group-hover:text-orange-700">
            vs {match.opponent}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Sets{" "}
            <span className="stat-number text-sm font-bold text-slate-700">
              {setsLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
            resultClass,
          )}
        >
          {resultLabel}
        </span>
        <span className="hidden items-center gap-1 text-xs font-semibold text-orange-700 sm:inline-flex">
          {ctaLabel}
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </span>
      </div>
    </Link>
  );
}
