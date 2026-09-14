"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Plus, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SetWinChance } from "@/engine/win-probability";
import { WinChanceSparkline } from "@/components/charts/WinChanceSparkline";

interface ScoreboardProps {
  teamName: string;
  opponent: string;
  setIdx: number; // 0-based
  setCount: number;
  us: number;
  them: number;
  rotation: number; // 1..6
  serving: "us" | "them";
  offline: boolean;
  syncQueueSize: number;
  // Bumps a nonce when an auto-score fires so the scored side flashes briefly.
  flash: { side: "us" | "them"; nonce: number } | null;
  // Bumps each time the rotation auto-advances so R# flashes to catch the eye.
  rotationFlash: number;
  // Bumps each time the serve switches so the "Serving" pill pulses briefly.
  servingFlash: number;
  // Live set win probability for the current set.
  winChance: SetWinChance;
  onSetChange: (idx: number) => void;
  onAddSet: () => void;
  onScore: (who: "us" | "them", delta: 1 | -1) => void;
  onRotation: (delta: 1 | -1) => void;
  onServingToggle: () => void;
  onEditStart: () => void;
}

export function Scoreboard({
  teamName,
  opponent,
  setIdx,
  setCount,
  us,
  them,
  rotation,
  serving,
  offline,
  syncQueueSize,
  flash,
  rotationFlash,
  servingFlash,
  winChance,
  onSetChange,
  onAddSet,
  onScore,
  onRotation,
  onServingToggle,
  onEditStart,
}: ScoreboardProps) {
  // Light up the scored side for a beat when an auto-score lands.
  const [lit, setLit] = useState<"us" | "them" | null>(null);
  useEffect(() => {
    if (!flash) return;
    setLit(flash.side);
    const t = setTimeout(() => setLit(null), 450);
    return () => clearTimeout(t);
  }, [flash]);

  // Flash the rotation chip when it auto-advances (nonce 0 = initial, skip).
  const [rotLit, setRotLit] = useState(false);
  useEffect(() => {
    if (!rotationFlash) return;
    setRotLit(true);
    const t = setTimeout(() => setRotLit(false), 1000);
    return () => clearTimeout(t);
  }, [rotationFlash]);

  // Flash the serving pill when the serve switches sides (nonce 0 = initial).
  const [serveLit, setServeLit] = useState(false);
  useEffect(() => {
    if (!servingFlash) return;
    setServeLit(true);
    const t = setTimeout(() => setServeLit(false), 1000);
    return () => clearTimeout(t);
  }, [servingFlash]);

  // Tap the win-chance pill to expand the sparkline.
  const [chanceOpen, setChanceOpen] = useState(false);

  const usHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usDidLongPress = useRef(false);
  const themDidLongPress = useRef(false);

  function startHold(who: "us" | "them") {
    const timer = setTimeout(() => {
      if (who === "us") usDidLongPress.current = true;
      else themDidLongPress.current = true;
      onScore(who, -1);
    }, 500);
    if (who === "us") usHoldTimer.current = timer;
    else themHoldTimer.current = timer;
  }
  function endHold(who: "us" | "them") {
    const timer = who === "us" ? usHoldTimer.current : themHoldTimer.current;
    if (timer) clearTimeout(timer);
    if (who === "us") usHoldTimer.current = null;
    else themHoldTimer.current = null;
  }
  function onClickScore(who: "us" | "them") {
    if (who === "us" && usDidLongPress.current) {
      usDidLongPress.current = false;
      return;
    }
    if (who === "them" && themDidLongPress.current) {
      themDidLongPress.current = false;
      return;
    }
    onScore(who, 1);
  }

  return (
    <div className="card relative overflow-hidden">
      {/* Set tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 pt-3 sm:px-4">
        {Array.from({ length: setCount }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSetChange(i)}
            className={cn(
              "rounded px-3 py-1 font-display text-sm font-bold uppercase tracking-wide transition-colors",
              i === setIdx
                ? "bg-navy-900 text-white"
                : "bg-slate-100 text-slate-600 hover:text-slate-900",
            )}
          >
            Set {i + 1}
          </button>
        ))}
        {setCount < 5 && (
          <button
            type="button"
            onClick={onAddSet}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-900"
            aria-label="Add set"
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden />
          </button>
        )}
        {offline && (
          <span className="inline-flex items-center gap-1.5 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
            <WifiOff size={12} strokeWidth={2} aria-hidden />
            Offline {syncQueueSize > 0 && `· ${syncQueueSize} queued`}
          </span>
        )}
        <button
          type="button"
          onClick={() => setChanceOpen((v) => !v)}
          aria-expanded={chanceOpen}
          aria-label={`Set win chance ${winChance.pct === null ? "not available yet" : `${winChance.pct} percent`}. Tap for the trend.`}
          className={cn(
            "ml-auto inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 transition-colors",
            winChance.pct === null
              ? "border-slate-200 bg-white text-slate-500"
              : winChance.pct >= 50
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800",
          )}
        >
          <span className="font-display text-[10px] font-bold uppercase tracking-wider">Set win chance</span>
          <span className="stat-number text-base font-bold leading-none">
            {winChance.pct === null ? "—" : `${winChance.pct}%`}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={2.5}
            className={cn("transition-transform", chanceOpen && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>
      {chanceOpen && (
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 sm:mx-4">
          <WinChanceSparkline history={winChance.history} width={180} height={44} />
          <div className="min-w-0 flex-1 text-xs text-slate-600">
            <div className="flex items-center gap-1 font-semibold text-slate-800">
              <Info size={12} strokeWidth={2} aria-hidden />
              Set win chance
            </div>
            <div
              className="mt-0.5"
              title="Based on the current score and how many rallies your team has been winning this set"
            >
              Based on the current score and how many rallies your team has been
              winning this set. {winChance.rallies < 3 ? "Shows after 3 rallies." : `${winChance.rallies} rallies so far.`}
            </div>
          </div>
        </div>
      )}

      {/* Score - the scoreboard band */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch bg-navy-950 text-white">
        <button
          type="button"
          onPointerDown={() => startHold("us")}
          onPointerUp={() => endHold("us")}
          onPointerCancel={() => endHold("us")}
          onClick={() => onClickScore("us")}
          className={cn(
            "flex flex-col items-center py-3 transition-colors duration-150 active:bg-white/10",
            lit === "us" && "bg-emerald-500/30",
          )}
          aria-label="Our score: tap to add, hold to subtract"
        >
          <span className="max-w-full truncate px-2 font-display text-xs font-bold uppercase tracking-[0.16em] text-orange-300">
            {teamName}
          </span>
          <span className="stat-number text-6xl font-bold leading-none sm:text-7xl">
            {us}
          </span>
        </button>
        <span className="stat-number self-center text-3xl font-bold text-navy-400">-</span>
        <button
          type="button"
          onPointerDown={() => startHold("them")}
          onPointerUp={() => endHold("them")}
          onPointerCancel={() => endHold("them")}
          onClick={() => onClickScore("them")}
          className={cn(
            "flex flex-col items-center py-3 transition-colors duration-150 active:bg-white/10",
            lit === "them" && "bg-red-500/30",
          )}
          aria-label="Opponent score: tap to add, hold to subtract"
        >
          <span className="max-w-full truncate px-2 font-display text-xs font-bold uppercase tracking-[0.16em] text-navy-300">
            {opponent}
          </span>
          <span className="stat-number text-6xl font-bold leading-none sm:text-7xl">
            {them}
          </span>
        </button>
      </div>

      {/* Rotation + serving */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-3 text-sm sm:px-4">
        <div
          className={cn(
            "relative flex min-h-[40px] items-center gap-1 rounded-md border px-1.5 transition-all duration-300",
            rotLit
              ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
              : "border-slate-300 bg-white",
          )}
        >
          <span className="pl-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Rot</span>
          <button
            type="button"
            onClick={() => onRotation(-1)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Previous rotation"
          >
            <ChevronLeft size={16} strokeWidth={2.5} aria-hidden />
          </button>
          <span
            className={cn(
              "stat-number inline-block w-9 text-center text-xl font-bold leading-none transition-all duration-300",
              rotLit ? "scale-125 text-orange-700" : "text-slate-900",
            )}
          >
            R{rotation}
          </span>
          <button
            type="button"
            onClick={() => onRotation(1)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Next rotation"
          >
            <ChevronRight size={16} strokeWidth={2.5} aria-hidden />
          </button>
          {rotLit && (
            <span className="absolute -top-2 right-1 animate-pulse rounded bg-orange-500 px-1.5 font-display text-[9px] font-bold uppercase tracking-wide text-white">
              Rotated
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onServingToggle}
          className={cn(
            "min-h-[40px] rounded-md border px-3 font-semibold transition-all duration-300",
            serving === "us"
              ? "border-orange-300 bg-orange-50 text-orange-800"
              : "border-slate-300 bg-slate-100 text-slate-700",
            serveLit && "scale-105 ring-2 ring-orange-200",
          )}
          aria-label={`Serving: ${serving === "us" ? "Us" : "Them"}`}
        >
          Serving: {serving === "us" ? "Us" : "Them"}
        </button>
        <button
          type="button"
          onClick={onEditStart}
          className="btn-secondary min-h-[40px] py-1.5"
          aria-label="Set who serves first and starting rotation"
          title="Set serve & rotation start"
        >
          Start
        </button>
      </div>
    </div>
  );
}
