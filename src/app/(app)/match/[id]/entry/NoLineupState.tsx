"use client";

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import {
  NO_LINEUP_ACTION,
  NO_LINEUP_BODY,
  NO_LINEUP_HEADLINE,
} from "@/lib/match-state";

// What the courtside page shows before anyone is on the court.
//
// It replaces the scoreboard, the court and the action pad rather than sitting
// next to them, because a page that still offers buttons is a page that looks
// broken rather than one that looks unfinished. One obvious action, and a way
// out for a coach who opened the wrong match.
export function NoLineupState({
  onOpenLineup,
  backHref,
  backLabel,
}: {
  onOpenLineup: () => void;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div
      data-match-state="no_lineup"
      className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Users size={22} strokeWidth={2} aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">
        {NO_LINEUP_HEADLINE}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        {NO_LINEUP_BODY}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onOpenLineup} className="btn-primary">
          {NO_LINEUP_ACTION}
        </button>
        <Link href={backHref} className="btn-ghost">
          <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
