"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Radio } from "lucide-react";
import type { LiveSnapshot, LiveStats } from "@/lib/parent-view";
import { LiveScoreboard } from "@/components/parent/LiveScoreboard";
import { BACK_ON_COURT_CHIP, playerStateCopy } from "@/lib/player-state-copy";
import { WinChanceSparkline } from "@/components/charts/WinChanceSparkline";
import { cn, formatDate } from "@/lib/utils";

// How long the "Back on court" chip stays up after a child returns.
const BACK_ON_MS = 12_000;

function statsAreEmpty(s: LiveStats | null): s is null {
  if (!s) return true;
  return (
    s.kills === 0 && s.aces === 0 && s.blocks === 0 && s.digs === 0 &&
    s.assists === 0 && s.errors === 0 && s.srAttempts === 0
  );
}

// "4 kills, 2 digs" - the per-set line under the grid. Zeroes are left out.
function summarise(s: LiveStats): string {
  const parts: [number, string, string][] = [
    [s.kills, "kill", "kills"],
    [s.aces, "ace", "aces"],
    [s.blocks, "block", "blocks"],
    [s.digs, "dig", "digs"],
    [s.assists, "assist", "assists"],
  ];
  const said = parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (s.srAttempts > 0 && s.srAverage !== null) {
    said.push(`${s.srAttempts} ${s.srAttempts === 1 ? "pass" : "passes"} at ${s.srAverage.toFixed(2)}`);
  }
  return said.join(", ");
}

const LIVE_POLL_MS = 15_000; // during a match, tab visible
const QUIET_POLL_MS = 60_000; // after QUIET_AFTER unchanged polls (timeout, between sets)
const IDLE_POLL_MS = 60_000; // waiting for the coach to start a logged match
const QUIET_AFTER = 5;
const MIN_GAP_MS = 5_000; // a tab flipping hidden/visible can't spam the server

type PollMode = "live" | "quiet" | "idle" | "paused" | "stopped";

function modeFor(status: LiveSnapshot["status"], unchanged: number): PollMode {
  if (status === "final" || status === "none") return "stopped";
  if (status !== "live") return "idle";
  return unchanged >= QUIET_AFTER ? "quiet" : "live";
}
function delayFor(mode: PollMode) {
  return mode === "live" ? LIVE_POLL_MS : mode === "quiet" ? QUIET_POLL_MS : IDLE_POLL_MS;
}

// The child's current / most recent match. Plain polling - no websockets - so
// it keeps working on gym Wi-Fi. The poll is conditional (If-None-Match, so
// nothing-changed answers are an empty 304), pauses while the tab is hidden,
// slows to a minute after five unchanged answers, and stops once the match
// is final.
export function LiveMatchCard({
  teamId,
  playerId,
  playerName,
  initial,
}: {
  teamId: string;
  playerId: string;
  playerName: string;
  initial: LiveSnapshot;
}) {
  const [snap, setSnap] = useState<LiveSnapshot>(initial);
  const [lastPoll, setLastPoll] = useState<number | null>(null);
  const [mode, setMode] = useState<PollMode>(modeFor(initial.status, 0));
  const etagRef = useRef<string>(initial.etag);
  const unchangedRef = useRef(0);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    if (snap.status === "final" || snap.status === "none") {
      setMode("stopped");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        // Nothing to show; the visibilitychange handler restarts us.
        setMode("paused");
        return;
      }
      const sinceLast = Date.now() - lastFetchRef.current;
      if (sinceLast < MIN_GAP_MS) {
        schedule(MIN_GAP_MS - sinceLast);
        return;
      }
      lastFetchRef.current = Date.now();
      let status = snap.status;
      try {
        const res = await fetch(`/api/parent/live?team=${teamId}&player=${playerId}`, {
          cache: "no-store",
          headers: etagRef.current ? { "If-None-Match": etagRef.current } : undefined,
        });
        if (cancelled) return;
        if (res.status === 304) {
          unchangedRef.current += 1;
        } else if (res.status === 429) {
          const wait = (Number(res.headers.get("Retry-After")) || 60) * 1000;
          setMode("quiet");
          schedule(wait);
          return;
        } else if (res.ok) {
          const next = (await res.json()) as LiveSnapshot;
          const tag = res.headers.get("ETag") ?? next.etag;
          if (tag !== etagRef.current) {
            etagRef.current = tag;
            unchangedRef.current = 0;
            setSnap(next);
          } else {
            unchangedRef.current += 1;
          }
          status = next.status;
        }
        setLastPoll(Date.now());
      } catch {
        // Keep the last snapshot; try again next tick.
      }
      if (cancelled) return;
      const nextMode = modeFor(status, unchangedRef.current);
      setMode(nextMode);
      if (nextMode !== "stopped") schedule(delayFor(nextMode));
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const first = modeFor(snap.status, unchangedRef.current);
    setMode(document.visibilityState === "hidden" ? "paused" : first);
    schedule(delayFor(first));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [teamId, playerId, snap.status]);

  // A substitution should register without shouting: when the child goes back
  // on, the chip says so for a few seconds and then settles to "On court".
  const prevStateRef = useRef(initial.playerState);
  const [backOn, setBackOn] = useState(false);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = snap.playerState;
    if (snap.playerState !== "on_court") return;
    if (prev !== "off_court" && prev !== "bench") return;
    setBackOn(true);
    const t = setTimeout(() => setBackOn(false), BACK_ON_MS);
    return () => clearTimeout(t);
  }, [snap.playerState]);

  if (snap.status === "none" || !snap.match) {
    return (
      <section className="card p-5">
        <div className="eyebrow text-slate-500">Latest match</div>
        <p className="mt-2 text-sm text-slate-600">
          No matches logged yet. Once the coach starts a match, {playerName}&apos;s
          numbers show up here and update while they play.
        </p>
      </section>
    );
  }

  const m = snap.match;
  const isLive = snap.status === "live";
  const isFinal = snap.status === "final";
  const firstName = playerName.split(" ")[0] || playerName;
  // Once the match is over nobody is on court, so the live states stop
  // applying. "Not in this match" still does, and stays.
  const shownState =
    isLive || snap.playerState === "not_in_match" ? snap.playerState : "unknown";
  const copy = playerStateCopy(shownState, firstName);
  const notInMatch = snap.playerState === "not_in_match";
  const chip = backOn && isLive ? BACK_ON_COURT_CHIP : copy.chip;
  const matchStatsLabel = isFinal ? "This match" : copy.matchStatsLabel;

  // Match totals. A substitution never takes these off the screen and never
  // moves them: what the child has already banked stays banked.
  const stats = notInMatch ? null : snap.stats;
  // The per-set figure, shown only while off the court and only when there is
  // something to show.
  const thisSet =
    isLive && snap.playerState === "off_court" && !statsAreEmpty(snap.setStats)
      ? snap.setStats
      : null;

  return (
    <section className={cn("card overflow-hidden", isLive && "border-cyan-300")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <div className="min-w-0">
          <div className="eyebrow text-slate-500">
            {isLive ? "Happening now" : isFinal ? "Latest match" : "Next up"}
          </div>
          <div className="mt-1 truncate font-display text-xl font-bold leading-none text-slate-900">
            vs {m.opponent}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {m.tournamentName} · Match {m.matchNumber} · {formatDate(m.tournamentDate)}
          </div>
        </div>
        {!isLive && !isFinal && (
          <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider text-slate-600">
            <Radio size={14} strokeWidth={2} aria-hidden />
            Waiting for the coach
          </span>
        )}
      </div>

      {/* The score, in every player state. A parent wants it either way. */}
      <LiveScoreboard snap={snap} />

      {isLive && snap.currentSet && <SetWinChanceBar current={snap.currentSet} />}

      {/* Where the child is right now. */}
      <div
        key={shownState}
        className="border-b border-slate-100 px-5 py-3 motion-safe:animate-state-in"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-base font-bold text-slate-900">{playerName}</span>
          {chip && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider",
                shownState === "on_court"
                  ? "bg-green-50 text-green-700"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              {shownState === "on_court" && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-600" />
                </span>
              )}
              {chip}
            </span>
          )}
        </div>
        {copy.message && (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600" aria-live="polite">
            {copy.message}
          </p>
        )}
      </div>

      {stats && !statsAreEmpty(stats) ? (
        <>
          <div className="flex items-center justify-between px-5 pt-3">
            <span className="eyebrow text-slate-500">{matchStatsLabel}</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-y divide-slate-100 sm:grid-cols-6 sm:divide-y-0">
            <LiveStat label="Kills" value={stats.kills} />
            <LiveStat label="Aces" value={stats.aces} />
            <LiveStat label="Digs" value={stats.digs} />
            <LiveStat label="Blocks" value={stats.blocks} />
            <LiveStat label="Errors" value={stats.errors} tone="red" />
            <LiveStat
              label="Pass rating"
              value={stats.srAverage === null ? "-" : stats.srAverage.toFixed(2)}
              hint={stats.srAttempts > 0 ? `${stats.srAttempts} passes` : "out of 3"}
            />
          </div>
          {thisSet && (
            <p className="border-t border-slate-100 px-5 py-2.5 text-sm text-slate-600 motion-safe:animate-state-in">
              <span className="font-semibold text-slate-900">{copy.setStatsLabel}:</span>{" "}
              {summarise(thisSet)}
            </p>
          )}
        </>
      ) : notInMatch ? null : (
        <p className="px-5 py-4 text-sm text-slate-600">
          {shownState === "bench"
            ? `Nothing recorded for ${firstName} in this match yet.`
            : `${firstName} hasn't recorded a stat in this match yet.`}
        </p>
      )}

      {snap.bankAccount && !notInMatch && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm">
          <span className="text-slate-600">Bank Account this match</span>
          {snap.bankAccount.balance >= 0 ? (
            <span className="inline-flex items-center gap-2">
              <span className="stat-number text-xl font-bold" style={{ color: snap.bankAccount.ratingColor }}>
                +{snap.bankAccount.balance}
              </span>
              <span
                className="rounded px-1.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider text-white"
                style={{ background: snap.bankAccount.ratingColor }}
              >
                {snap.bankAccount.ratingLabel}
              </span>
            </span>
          ) : (
            /* Mid-match, in the stands, next to the child. Never a red minus
               number as the headline. */
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="stat-number text-lg font-bold text-green-700">
                {snap.bankAccount.deposits}
              </span>
              <span className="text-slate-500">good plays</span>
              <span className="stat-number text-lg font-bold text-slate-700">
                {snap.bankAccount.withdrawals}
              </span>
              <span className="text-slate-500">errors</span>
            </span>
          )}
        </div>
      )}

      {mode !== "stopped" && (
        <div className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-500" data-poll-mode={mode}>
          {mode === "paused"
            ? "Paused while this tab is in the background"
            : mode === "quiet"
              ? "Quiet spell - checking every minute"
              : mode === "idle"
                ? "Checking every minute for the coach to start"
                : "Updates every 15 seconds"}
          {lastPoll ? ` \u00b7 last check ${new Date(lastPoll).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : ""}
        </div>
      )}
    </section>
  );
}

function LiveStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "red";
}) {
  return (
    <div className="px-4 py-3 text-center">
      <div className={cn("stat-number text-3xl font-bold leading-none", tone === "red" ? "text-red-700" : "text-slate-900")}>
        {value}
      </div>
      <div className="eyebrow mt-1 text-[10px] text-slate-500">{label}</div>
      {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}

// "Set win chance: 72%" - a bar that fills green above 50% and red below,
// with the trend of the set so far.
function SetWinChanceBar({ current }: { current: NonNullable<LiveSnapshot["currentSet"]> }) {
  const pct = current.winChancePct;
  const good = pct !== null && pct >= 50;
  return (
    <div className="border-b border-slate-100 px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold uppercase tracking-wider text-slate-700">
            Set win chance
          </span>
          <span
            className="inline-flex text-slate-400"
            title="Based on the current score and how many rallies your team has been winning this set"
            aria-label="Based on the current score and how many rallies your team has been winning this set"
          >
            <Info size={14} strokeWidth={2} aria-hidden />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Set {current.setNumber} · {current.us}-{current.them}
          </span>
          <span
            className={cn(
              "stat-number text-2xl font-bold leading-none",
              pct === null ? "text-slate-400" : good ? "text-green-700" : "text-red-700",
            )}
          >
            {pct === null ? "\u2014" : `${pct}%`}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} aria-label="Set win chance">
          <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" aria-hidden />
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", good ? "bg-green-600" : "bg-red-600")}
            style={{ width: `${pct ?? 0}%` }}
          />
        </div>
        <WinChanceSparkline history={current.winChanceHistory} width={120} height={32} className="shrink-0" />
      </div>
      {pct === null && (
        <div className="mt-1 text-[11px] text-slate-500">Shows after 3 rallies in the set.</div>
      )}
    </div>
  );
}
