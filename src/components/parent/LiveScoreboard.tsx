"use client";

import type { LiveSnapshot } from "@/lib/parent-view";
import { cn } from "@/lib/utils";

// The score, big enough to read at a glance from the bleachers. Shown in every
// player state: a parent wants the score whether or not their child is on the
// court this minute.
export function LiveScoreboard({ snap }: { snap: LiveSnapshot }) {
  const m = snap.match;
  if (!m) return null;
  const isLive = snap.status === "live";
  const isFinal = snap.status === "final";

  // Live: the set in progress. Final: the last set played.
  const current = snap.currentSet;
  const shown = current ?? snap.sets[snap.sets.length - 1] ?? null;
  const priorSets = snap.sets.filter((s) => !shown || s.setNumber < shown.setNumber);

  // The coach's own set tally wins once the match is final; before that, count
  // the sets the scores have already decided.
  const tally =
    isFinal && (m.setsWon > 0 || m.setsLost > 0)
      ? { us: m.setsWon, them: m.setsLost }
      : snap.setsTally;

  return (
    <div className={cn("px-5 py-4", isLive ? "bg-navy-950 text-white" : "border-b border-slate-200 bg-white")}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("eyebrow", isLive ? "text-cyan-500" : "text-slate-500")}>
          {isLive
            ? shown
              ? `Set ${shown.setNumber}`
              : "Warming up"
            : isFinal
              ? "Final"
              : "Next up"}
        </span>
        {isLive ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
            </span>
            Live
          </span>
        ) : isFinal ? (
          <FinalResult result={m.result} us={tally.us} them={tally.them} />
        ) : null}
      </div>

      {shown ? (
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-x-3">
          <TeamSide name={m.teamName} score={shown.us} live={isLive} align="left" />
          <span
            className={cn(
              "stat-number pb-1 text-2xl font-bold leading-none",
              isLive ? "text-navy-300" : "text-slate-400",
            )}
            aria-hidden
          >
            -
          </span>
          <TeamSide name={m.opponent} score={shown.them} live={isLive} align="right" />
        </div>
      ) : (
        <p className={cn("mt-2 text-sm", isLive ? "text-navy-200" : "text-slate-600")}>
          The score shows here as soon as the first point is scored.
        </p>
      )}

      {/* Screen readers get the score as one sentence rather than three cells. */}
      {shown && (
        <p className="sr-only" aria-live="polite">
          {isFinal ? "Final score" : `Set ${shown.setNumber}`}: {m.teamName} {shown.us},{" "}
          {m.opponent} {shown.them}.
        </p>
      )}

      {priorSets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {priorSets.map((s) => (
            <span
              key={s.setNumber}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                isLive ? "bg-white/10 text-navy-100" : "bg-slate-100 text-slate-600",
              )}
            >
              Set {s.setNumber}: <span className="stat-number font-bold">{s.us}-{s.them}</span>
              {s.decided && (
                <span
                  className={cn(
                    "font-display font-bold uppercase",
                    s.decided === "us"
                      ? isLive ? "text-green-400" : "text-green-700"
                      : isLive ? "text-red-400" : "text-red-700",
                  )}
                >
                  {s.decided === "us" ? "W" : "L"}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamSide({
  name,
  score,
  live,
  align,
}: {
  name: string;
  score: number;
  live: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <div
        className={cn(
          "truncate font-display text-sm font-bold uppercase tracking-wide",
          live ? "text-navy-100" : "text-slate-600",
        )}
        title={name}
      >
        {name}
      </div>
      <div
        className={cn(
          "stat-number text-5xl font-bold leading-none tabular-nums sm:text-6xl",
          live ? "text-white" : "text-slate-900",
        )}
      >
        {score}
      </div>
    </div>
  );
}

function FinalResult({
  result,
  us,
  them,
}: {
  result: NonNullable<LiveSnapshot["match"]>["result"];
  us: number;
  them: number;
}) {
  const label = result === "WIN" ? "Won" : result === "LOSS" ? "Lost" : "Final";
  const tone =
    result === "WIN"
      ? "bg-green-50 text-green-700"
      : result === "LOSS"
        ? "bg-red-50 text-red-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={cn("rounded px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wider", tone)}>
      {label} {us}-{them}
    </span>
  );
}
