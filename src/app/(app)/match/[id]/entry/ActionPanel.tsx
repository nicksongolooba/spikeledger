"use client";

import type { Position } from "@prisma/client";
import { POSITION_GROUP } from "@/lib/positions";
import { cn } from "@/lib/utils";
import type { StatActionId } from "@/lib/stat-actions";
import type { RosterPlayer } from "./types";

interface ActionButton {
  id: StatActionId;
  label: string;
  icon: string;
}

const POSITIVE: ActionButton[] = [
  { id: "KILL", label: "KILL", icon: "⚡" },
  { id: "ACE", label: "ACE", icon: "🎯" },
  { id: "BLOCK", label: "BLOCK", icon: "🛡" },
];

const NEUTRAL: ActionButton[] = [
  { id: "ASSIST", label: "ASSIST", icon: "➡" },
  { id: "DIG", label: "DIG", icon: "⬇" },
];

const NEGATIVE: ActionButton[] = [
  { id: "S_ERR", label: "S.ERR", icon: "✕" },
  { id: "NET_ERR", label: "NET.ERR", icon: "✕" },
  { id: "A_ERR", label: "A.ERR", icon: "✕" },
  { id: "GEN_ERR", label: "GEN.ERR", icon: "✕" },
];

const SR: { id: StatActionId; label: string; ring: string; bg: string }[] = [
  { id: "SR_0", label: "0", ring: "border-red-400", bg: "bg-red-400/15 text-red-300" },
  { id: "SR_1", label: "1", ring: "border-amber-400", bg: "bg-amber-400/15 text-amber-300" },
  { id: "SR_2", label: "2", ring: "border-blue-400", bg: "bg-blue-400/15 text-blue-300" },
  { id: "SR_3", label: "3", ring: "border-emerald-400", bg: "bg-emerald-400/15 text-emerald-300" },
];

// Liberos/DS shouldn't attack or block in standard play. Dim those buttons but
// still allow taps for the rare rec-league override case.
const LIBERO_RESTRICTED = new Set<StatActionId>(["KILL", "BLOCK"]);

export function ActionPanel({
  player,
  positionPlayed,
  onAction,
}: {
  player: RosterPlayer | null;
  positionPlayed: Position | null;
  onAction: (action: StatActionId) => void;
}) {
  if (!player) {
    return (
      <div className="card flex min-h-[180px] items-center justify-center p-6 text-sm text-slate-500">
        Tap a player to record a stat.
      </div>
    );
  }

  const group = POSITION_GROUP[positionPlayed ?? player.primaryPosition];
  const restrict = (id: StatActionId) =>
    group === "libero" && LIBERO_RESTRICTED.has(id);

  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
            Recording for
          </div>
          <div className="text-lg font-bold text-slate-100">
            {player.name}{" "}
            <span className="font-normal text-slate-500">
              #{player.number ?? "-"} · {positionPlayed ?? player.primaryPosition}
            </span>
          </div>
        </div>
      </div>

      <ActionRow
        actions={POSITIVE}
        category="positive"
        onAction={onAction}
        restrict={restrict}
      />
      <ActionRow
        actions={NEUTRAL}
        category="neutral"
        onAction={onAction}
        restrict={restrict}
      />
      <ActionRow
        actions={NEGATIVE}
        category="negative"
        onAction={onAction}
        restrict={restrict}
      />

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
          <span>Serve Receive</span>
          <span className="text-slate-600">0 worst · 3 perfect</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SR.map((sr) => (
            <button
              key={sr.id}
              type="button"
              onClick={() => onAction(sr.id)}
              className={cn(
                "flex min-h-[60px] flex-col items-center justify-center rounded-lg border-2 font-bold transition-all active:scale-95",
                sr.ring,
                sr.bg,
              )}
            >
              <span className="stat-number text-2xl">{sr.label}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                SR
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  actions,
  category,
  onAction,
  restrict,
}: {
  actions: ActionButton[];
  category: "positive" | "neutral" | "negative";
  onAction: (a: StatActionId) => void;
  restrict: (id: StatActionId) => boolean;
}) {
  const baseByCategory = {
    positive:
      "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 active:bg-emerald-400/20",
    neutral:
      "border-cyan-400/40 bg-cyan-400/10 text-cyan-300 active:bg-cyan-400/20",
    negative:
      "border-red-400/40 bg-red-400/10 text-red-300 active:bg-red-400/20",
  }[category];

  const gridCols =
    actions.length === 2
      ? "grid-cols-2"
      : actions.length === 3
        ? "grid-cols-3"
        : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className={cn("mt-2 grid gap-2", gridCols)}>
      {actions.map((a) => {
        const isRestricted = restrict(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onAction(a.id)}
            className={cn(
              "flex min-h-[60px] flex-col items-center justify-center rounded-lg border-2 font-bold transition-all active:scale-95",
              baseByCategory,
              isRestricted && "opacity-40",
            )}
            aria-label={
              isRestricted
                ? `${a.label} - uncommon for this position`
                : a.label
            }
          >
            <span className="text-base">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}
