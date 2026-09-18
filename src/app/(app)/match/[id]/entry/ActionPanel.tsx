"use client";

import type { Position } from "@prisma/client";
import { POSITION_GROUP } from "@/lib/positions";
import { cn } from "@/lib/utils";
import type { StatActionId } from "@/lib/stat-actions";
import type { RosterPlayer } from "./types";

interface ActionButton {
  id: StatActionId;
  label: string;
  // What belongs in this button, for a coach who is not sure. Shown on hover
  // and read out by a screen reader.
  hint?: string;
}

const POSITIVE: ActionButton[] = [
  { id: "KILL", label: "Kill" },
  { id: "ACE", label: "Ace" },
  { id: "BLOCK", label: "Block" },
];

const NEUTRAL: ActionButton[] = [
  { id: "ASSIST", label: "Assist" },
  { id: "DIG", label: "Dig" },
];

const NEGATIVE: ActionButton[] = [
  { id: "S_ERR", label: "Serve err" },
  { id: "NET_ERR", label: "Net err" },
  { id: "A_ERR", label: "Attack err" },
  // The setter's own mistake: a double, a lift, or a set the attacker cannot
  // swing on. Recorded but never scored until now.
  { id: "SET_ERR", label: "Set err", hint: "A double, a lift, or a set the attacker could not swing on" },
  // A ball touched in defence and not kept alive. Pairs with Dig.
  { id: "DIG_ERR", label: "Dig err", hint: "A ball touched in defence and not kept alive" },
  // Renamed from "Gen. err". It was a catch-all by omission: no label, no
  // definition, and nothing downstream could tell its contents apart. Now that
  // setting and digging have their own buttons, this is what is left.
  { id: "GEN_ERR", label: "Other err", hint: "Anything without its own button: rotation faults, foot faults, illegal contact" },
];

// Serve-receive quality 0 (shank) to 3 (perfect). Solid fills so the four
// grades read at a glance from arm's length in a bright gym.
const SR: { id: StatActionId; label: string; className: string }[] = [
  { id: "SR_0", label: "0", className: "bg-red-600 active:bg-red-700" },
  { id: "SR_1", label: "1", className: "bg-amber-600 active:bg-amber-700" },
  { id: "SR_2", label: "2", className: "bg-sky-600 active:bg-sky-700" },
  { id: "SR_3", label: "3", className: "bg-green-600 active:bg-green-700" },
];

// Liberos/DS shouldn't attack or block in standard play. Dim those buttons but
// still allow taps for the rare rec-league override case.
const LIBERO_RESTRICTED = new Set<StatActionId>(["KILL", "BLOCK"]);

export function ActionPanel({
  player,
  positionPlayed,
  onAction,
  onOpponentError,
  opponentErrors,
  restrictByPosition = true,
}: {
  player: RosterPlayer | null;
  positionPlayed: Position | null;
  onAction: (action: StatActionId) => void;
  onOpponentError: () => void;
  opponentErrors: number;
  // false on no-positions teams: every button is live for every player.
  restrictByPosition?: boolean;
}) {
  const group = player
    ? POSITION_GROUP[positionPlayed ?? player.primaryPosition]
    : null;
  const restrict = (id: StatActionId) =>
    restrictByPosition && group === "libero_ds" && LIBERO_RESTRICTED.has(id);

  return (
    <div className="card p-3 sm:p-4">
      {/* Opponent error: no player needed - it's a point we didn't earn. */}
      <button
        type="button"
        onClick={onOpponentError}
        className="flex min-h-[56px] w-full items-center justify-between rounded-md border-2 border-amber-300 bg-amber-50 px-4 py-2.5 text-left text-amber-900 transition-all active:scale-[0.99] active:bg-amber-100"
      >
        <span className="flex flex-col">
          <span className="font-display text-lg font-bold uppercase tracking-wide">
            Opp error
          </span>
          <span className="text-[11px] font-medium text-amber-800/80">
            Opponent mistake - point for us
          </span>
        </span>
        <span className="stat-number rounded bg-amber-200 px-2.5 py-0.5 text-lg font-bold">
          {opponentErrors}
        </span>
      </button>

      <div className="my-3 h-px bg-slate-200" />

      {!player ? (
        <div className="flex min-h-[140px] items-center justify-center rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          Tap a player to record a stat.
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="eyebrow">Recording for</div>
              <div className="font-display text-2xl font-bold leading-none text-slate-900">
                {player.name}{" "}
                <span className="text-lg font-medium text-slate-500">
                  #{player.number ?? "-"}
                  {restrictByPosition ? ` · ${positionPlayed ?? player.primaryPosition}` : ""}
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

          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow text-slate-600">Serve receive</span>
              <span className="text-[11px] text-slate-500">0 shank · 3 perfect</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SR.map((sr) => (
                <button
                  key={sr.id}
                  type="button"
                  onClick={() => onAction(sr.id)}
                  className={cn(
                    "flex min-h-[64px] flex-col items-center justify-center rounded-md text-white transition-all active:scale-95",
                    sr.className,
                  )}
                  aria-label={`Serve receive ${sr.label}`}
                >
                  <span className="stat-number text-3xl font-bold leading-none">
                    {sr.label}
                  </span>
                  <span className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest opacity-80">
                    SR
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
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
  // Solid fills: green for points we earned, navy for the plays that keep a
  // rally alive, red for errors. White labels pass contrast on all three.
  const baseByCategory = {
    positive: "bg-green-600 active:bg-green-700",
    neutral: "bg-navy-800 active:bg-navy-900",
    negative: "bg-red-600 active:bg-red-700",
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
              "flex min-h-[64px] items-center justify-center rounded-md px-2 font-display text-lg font-bold uppercase tracking-wide text-white transition-all active:scale-95",
              baseByCategory,
              isRestricted && "opacity-40",
            )}
            title={a.hint}
            aria-label={
              isRestricted
                ? `${a.label} - uncommon for this position`
                : a.hint
                  ? `${a.label} - ${a.hint}`
                  : a.label
            }
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
