"use client";

import { useEffect, useState } from "react";
import { Info, Radio } from "lucide-react";
import type { LiveSnapshot } from "@/lib/parent-view";
import { WinChanceSparkline } from "@/components/charts/WinChanceSparkline";
import { cn, formatDate } from "@/lib/utils";

const LIVE_POLL_MS = 15_000; // during a match
const IDLE_POLL_MS = 60_000; // waiting for the coach to start a logged match

// The child's current / most recent match. Simple polling - no websockets -
// so it keeps working on gym Wi-Fi and stops on its own when the match ends.
export function LiveMatchCard({
  playerId,
  playerName,
  initial,
}: {
  playerId: string;
  playerName: string;
  initial: LiveSnapshot;
}) {
  const [snap, setSnap] = useState<LiveSnapshot>(initial);
  const [lastPoll, setLastPoll] = useState<number | null>(null);

  useEffect(() => {
    if (snap.status !== "live" && snap.status !== "pending") return;
    const interval = snap.status === "live" ? LIVE_POLL_MS : IDLE_POLL_MS;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/parent/player/${playerId}/live`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as LiveSnapshot;
        if (!cancelled) {
          setSnap(next);
          setLastPoll(Date.now());
        }
      } catch {
        // Keep the last snapshot; try again next tick.
      }
    };
    const id = setInterval(tick, interval);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [playerId, snap.status]);

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
  const stats = snap.stats;
  const resultTone =
    m.result === "WIN" ? "bg-emerald-50 text-emerald-700" : m.result === "LOSS" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600";

  return (
    <section className={cn("card overflow-hidden", isLive && "border-orange-300")}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-4", isLive ? "bg-navy-950 text-white" : "border-b border-slate-200")}>
        <div>
          <div className={cn("eyebrow", isLive ? "text-orange-300" : "text-slate-500")}>
            {isLive ? "Happening now" : isFinal ? "Latest match" : "Next up"}
          </div>
          <div className="mt-1 font-display text-2xl font-bold leading-none">
            vs {m.opponent}
          </div>
          <div className={cn("mt-1 text-xs", isLive ? "text-navy-200" : "text-slate-500")}>
            {m.tournamentName} · Match {m.matchNumber} · {formatDate(m.tournamentDate)}
          </div>
        </div>
        {isLive ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-display text-sm font-bold uppercase tracking-widest text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
            </span>
            Live
          </span>
        ) : isFinal ? (
          <span className={cn("rounded px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wider", resultTone)}>
            Final{m.result === "WIN" ? " · Win" : m.result === "LOSS" ? " · Loss" : ""} {m.setsWon}-{m.setsLost}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wider text-slate-600">
            <Radio size={14} strokeWidth={2} aria-hidden />
            Waiting for the coach
          </span>
        )}
      </div>

      {(isLive || isFinal) && snap.sets.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-2.5 text-sm">
          <span className="eyebrow text-slate-500">Sets</span>
          {snap.sets.map((s) => (
            <span
              key={s.setNumber}
              className={cn(
                "stat-number text-base font-bold",
                s.decided === "us" ? "text-emerald-700" : s.decided === "them" ? "text-red-700" : "text-slate-900",
              )}
              title={`Set ${s.setNumber}`}
            >
              {s.us}-{s.them}
            </span>
          ))}
        </div>
      )}

      {isLive && snap.currentSet && (
        <SetWinChanceBar current={snap.currentSet} />
      )}

      {stats ? (
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
      ) : (
        <p className="px-5 py-4 text-sm text-slate-600">
          {playerName} hasn&apos;t recorded a stat in this match yet.
        </p>
      )}

      {snap.bankAccount && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm">
          <span className="text-slate-600">Bank Account this match</span>
          <span className="inline-flex items-center gap-2">
            <span className="stat-number text-xl font-bold" style={{ color: snap.bankAccount.ratingColor }}>
              {snap.bankAccount.balance > 0 ? `+${snap.bankAccount.balance}` : snap.bankAccount.balance}
            </span>
            <span
              className="rounded px-1.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ background: snap.bankAccount.ratingColor }}
            >
              {snap.bankAccount.ratingLabel}
            </span>
          </span>
        </div>
      )}

      {isLive && (
        <div className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-500">
          Updates every 15 seconds{lastPoll ? ` · last update ${new Date(lastPoll).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : ""}
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
              pct === null ? "text-slate-400" : good ? "text-emerald-700" : "text-red-700",
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
            className={cn("h-full rounded-full transition-[width] duration-500", good ? "bg-emerald-600" : "bg-red-600")}
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
