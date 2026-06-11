"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ScoreboardProps {
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
  onSetChange: (idx: number) => void;
  onAddSet: () => void;
  onScore: (who: "us" | "them", delta: 1 | -1) => void;
  onRotation: (delta: 1 | -1) => void;
  onServingToggle: () => void;
  onEditStart: () => void;
}

export function Scoreboard({
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
    <div className="card relative p-3 sm:p-4">
      {/* Set tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {Array.from({ length: setCount }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSetChange(i)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
              i === setIdx
                ? "bg-volt-400 text-volt-950"
                : "bg-slate-800 text-slate-400 hover:text-slate-100",
            )}
          >
            Set {i + 1}
          </button>
        ))}
        {setCount < 5 && (
          <button
            type="button"
            onClick={onAddSet}
            className="rounded-md border border-dashed border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-100"
            aria-label="Add set"
          >
            +
          </button>
        )}
        {offline && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-amber-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Offline {syncQueueSize > 0 && `· ${syncQueueSize} queued`}
          </span>
        )}
      </div>

      {/* Score */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          type="button"
          onPointerDown={() => startHold("us")}
          onPointerUp={() => endHold("us")}
          onPointerCancel={() => endHold("us")}
          onClick={() => onClickScore("us")}
          className={cn(
            "flex flex-col items-center rounded-xl border py-2 transition-colors duration-150 active:bg-slate-800",
            lit === "us"
              ? "border-emerald-400 bg-emerald-400/25"
              : "border-slate-800 bg-slate-950",
          )}
          aria-label="Our score: tap to add, hold to subtract"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-volt-300">
            Hawks
          </span>
          <span className="stat-number text-4xl font-bold text-slate-50 sm:text-5xl">
            {us}
          </span>
        </button>
        <span className="stat-number text-2xl font-bold text-slate-600">-</span>
        <button
          type="button"
          onPointerDown={() => startHold("them")}
          onPointerUp={() => endHold("them")}
          onPointerCancel={() => endHold("them")}
          onClick={() => onClickScore("them")}
          className={cn(
            "flex flex-col items-center rounded-xl border py-2 transition-colors duration-150 active:bg-slate-800",
            lit === "them"
              ? "border-red-400 bg-red-400/25"
              : "border-slate-800 bg-slate-950",
          )}
          aria-label="Opponent score: tap to add, hold to subtract"
        >
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {opponent}
          </span>
          <span className="stat-number text-4xl font-bold text-slate-50 sm:text-5xl">
            {them}
          </span>
        </button>
      </div>

      {/* Rotation + serving */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <div
          className={cn(
            "relative flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-all duration-300",
            rotLit
              ? "border-volt-400 bg-volt-400/15 shadow-[0_0_0_3px_rgba(34,211,238,0.25)]"
              : "border-slate-800 bg-slate-950",
          )}
        >
          <span className="text-slate-500">Rot</span>
          <button
            type="button"
            onClick={() => onRotation(-1)}
            className="rounded px-1 text-slate-400 hover:text-slate-100"
            aria-label="Previous rotation"
          >
            ◀
          </button>
          <span
            className={cn(
              "stat-number inline-block w-9 text-center text-lg font-bold leading-none transition-all duration-300",
              rotLit ? "scale-150 text-volt-300" : "text-slate-100",
            )}
          >
            R{rotation}
          </span>
          <button
            type="button"
            onClick={() => onRotation(1)}
            className="rounded px-1 text-slate-400 hover:text-slate-100"
            aria-label="Next rotation"
          >
            ▶
          </button>
          {rotLit && (
            <span className="absolute -top-2 right-1 animate-pulse rounded-full bg-volt-400 px-1.5 text-[9px] font-bold uppercase tracking-wide text-volt-950">
              Rotated
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onServingToggle}
          className={cn(
            "rounded-lg border px-3 py-1 font-semibold transition-all duration-300",
            serving === "us"
              ? "border-volt-400 bg-volt-400/10 text-volt-300"
              : "border-amber-400 bg-amber-400/10 text-amber-300",
            serveLit && "scale-105 shadow-[0_0_0_3px_rgba(34,211,238,0.25)]",
          )}
          aria-label={`Serving: ${serving === "us" ? "Us" : "Them"}`}
        >
          Serving: {serving === "us" ? "Us" : "Them"}
        </button>
        <button
          type="button"
          onClick={onEditStart}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-400 hover:text-slate-100"
          aria-label="Set who serves first and starting rotation"
          title="Set serve & rotation start"
        >
          Start
        </button>
      </div>
    </div>
  );
}
