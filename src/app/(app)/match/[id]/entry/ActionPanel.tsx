"use client";

import { useEffect, useState } from "react";
import type { Position } from "@prisma/client";
import { POSITION_GROUP } from "@/lib/positions";
import { cn } from "@/lib/utils";
import type { StatActionId } from "@/lib/stat-actions";
import {
  actionAvailability,
  unavailableLine,
  type CourtContext,
} from "@/lib/action-availability";
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

// One treatment for every action a player cannot perform: clearly grey, no
// press animation, still readable at arm's length. Not so faint that it reads
// as a rendering fault - the coach should see a button that is switched off,
// not a button that failed to load.
const DISABLED =
  "border border-slate-300 bg-slate-200 text-slate-500 cursor-not-allowed";

export function ActionPanel({
  player,
  positionPlayed,
  onAction,
  onOpponentError,
  opponentErrors,
  restrictByPosition = true,
  slot = null,
  serving = "us",
  onFixCourt,
}: {
  player: RosterPlayer | null;
  positionPlayed: Position | null;
  onAction: (action: StatActionId) => void;
  onOpponentError: () => void;
  opponentErrors: number;
  // false on no-positions teams: every button is live for every player.
  restrictByPosition?: boolean;
  // Where the tapped player is standing, 1 to 6. Null when unknown, which
  // means nothing gets gated.
  slot?: number | null;
  serving?: "us" | "them";
  // Rotation drifts when a coach misses a rotation or a sub goes unrecorded,
  // and a drifted court is what disables the wrong buttons. Always offered.
  onFixCourt?: () => void;
}) {
  const group = player
    ? POSITION_GROUP[positionPlayed ?? player.primaryPosition]
    : null;
  // The libero rule is about the position, not the team's mode: a no-positions
  // team has no libero, so it simply never fires.
  const court: CourtContext = {
    slot,
    serving,
    isLibero: restrictByPosition && group === "libero_ds",
  };
  const available = (id: StatActionId) => actionAvailability(id, court).available;
  const restrict = (id: StatActionId) =>
    restrictByPosition && group === "libero_ds" && LIBERO_RESTRICTED.has(id);

  // Why the last disabled button a coach tapped did nothing. A disabled button
  // records nothing, but it must not be silent: a control that responds to
  // nothing at all is the same failure as the blank court was.
  const [blocked, setBlocked] = useState<string | null>(null);
  // A different player is a different question, so the old answer goes away.
  useEffect(() => setBlocked(null), [player?.id, slot, serving]);

  function handle(id: StatActionId) {
    const a = actionAvailability(id, court);
    if (a.available) {
      setBlocked(null);
      onAction(id);
      return;
    }
    setBlocked(unavailableLine(a.reason, id));
  }

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
          {/* Fixed height and a single truncated line: a long name must not
              wrap, because that would push every button below it down and
              break the promise that an action stays where it was. */}
          <div className="mb-3 flex h-11 items-center justify-between">
            <div className="min-w-0">
              <div className="eyebrow">Recording for</div>
              <div className="truncate font-display text-2xl font-bold leading-none text-slate-900">
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
            court={court}
            onTap={handle}
            restrict={restrict}
            available={available}
          />
          <ActionRow
            actions={NEUTRAL}
            category="neutral"
            court={court}
            onTap={handle}
            restrict={restrict}
            available={available}
          />
          <ActionRow
            actions={NEGATIVE}
            category="negative"
            court={court}
            onTap={handle}
            restrict={restrict}
            available={available}
          />

          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow text-slate-600">Serve receive</span>
              <span className="text-[11px] text-slate-500">0 shank · 3 perfect</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SR.map((sr) => {
                const on = available(sr.id);
                return (
                  <button
                    key={sr.id}
                    data-action={sr.id}
                    data-disabled={on ? undefined : "1"}
                    type="button"
                    aria-disabled={!on}
                    tabIndex={on ? undefined : -1}
                    onClick={() => handle(sr.id)}
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center rounded-md transition-all",
                      on
                        ? cn("text-white active:scale-95", sr.className)
                        : DISABLED,
                    )}
                    aria-label={
                      on
                        ? `Serve receive ${sr.label}`
                        : `Serve receive ${sr.label} - unavailable. ${unavailableLine("we-are-serving")}`
                    }
                  >
                    <span className="stat-number text-3xl font-bold leading-none">
                      {sr.label}
                    </span>
                    <span className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest opacity-80">
                      SR
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Sits below every button, so what it says can never move one. */}
          <div
            data-blocked-reason={blocked ? "1" : undefined}
            className="mt-3 flex min-h-[38px] items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <p aria-live="polite" className="text-slate-700">
              {blocked}
            </p>
            {onFixCourt && (
              <button
                type="button"
                onClick={onFixCourt}
                className="btn-ghost shrink-0 px-2 py-1 text-xs"
              >
                Court wrong? Fix the lineup
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ActionRow({
  actions,
  category,
  court,
  onTap,
  restrict,
  available,
}: {
  actions: ActionButton[];
  category: "positive" | "neutral" | "negative";
  court: CourtContext;
  onTap: (a: StatActionId) => void;
  restrict: (id: StatActionId) => boolean;
  available: (id: StatActionId) => boolean;
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
        // Every action is always here, for every player, in every slot. An
        // unavailable one renders inert rather than vanishing: a button that
        // disappears takes its own explanation with it, and a pad whose
        // contents change under a coach's thumb is what causes mis-taps.
        const on = available(a.id);
        const why = on ? null : actionAvailability(a.id, court);
        const isRestricted = on && restrict(a.id);
        return (
          <button
            key={a.id}
            data-action={a.id}
            data-disabled={on ? undefined : "1"}
            type="button"
            aria-disabled={!on}
            // Inert controls stay out of the tab order: reachable to a screen
            // reader, which reads the reason, but never focused by a coach
            // tabbing for the next thing they can actually record.
            tabIndex={on ? undefined : -1}
            onClick={() => onTap(a.id)}
            className={cn(
              "flex min-h-[64px] items-center justify-center rounded-md px-2 font-display text-lg font-bold uppercase tracking-wide transition-all",
              on
                ? cn("text-white active:scale-95", baseByCategory)
                : DISABLED,
              isRestricted && "opacity-40",
            )}
            title={why && !why.available ? unavailableLine(why.reason, a.id) : a.hint}
            aria-label={
              why && !why.available
                ? `${a.label} - unavailable. ${unavailableLine(why.reason, a.id)}`
                : isRestricted
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
