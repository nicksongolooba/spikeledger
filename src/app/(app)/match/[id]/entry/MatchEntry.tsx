"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match, Position, StatLine } from "@prisma/client";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { STAT_ACTION_LABELS, type StatActionId } from "@/lib/stat-actions";
import { Scoreboard } from "./Scoreboard";
import { PlayerGrid } from "./PlayerGrid";
import { ActionPanel } from "./ActionPanel";
import { UndoBar } from "./UndoBar";
import { LineupModal } from "./LineupModal";
import { ToastStack, type ToastMsg } from "./Toast";
import {
  appendWal,
  newWalId,
  readWal,
  removeWal,
  sendWalEntry,
  type WalEntry,
} from "./wal";
import type { PositionByPlayer, RosterPlayer, SetScore, UndoEntry } from "./types";

interface Props {
  match: Match;
  team: { id: string; name: string };
  tournament: { id: string; name: string };
  roster: RosterPlayer[];
  initialStatLines: StatLine[];
}

const LS_PREFIX = "spikeledger:entry:";

interface PersistedState {
  onCourt: string[];
  positions: PositionByPlayer;
  setIdx: number;
  sets: SetScore[];
  rotation: number;
  serving: "us" | "them";
  undo: UndoEntry[];
}

function lsKey(matchId: string) {
  return LS_PREFIX + matchId;
}
function readPersisted(matchId: string): Partial<PersistedState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lsKey(matchId));
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : null;
  } catch {
    return null;
  }
}
function writePersisted(matchId: string, state: PersistedState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(lsKey(matchId), JSON.stringify(state));
}

export function MatchEntry({
  match,
  team,
  tournament,
  roster,
  initialStatLines,
}: Props) {
  const router = useRouter();
  const matchId = match.id;

  // ---- Initial state ----
  const persisted = useMemo(() => readPersisted(matchId), [matchId]);

  // positions per player, defaulting from any saved positionPlayed in DB
  const initialPositions: PositionByPlayer = useMemo(() => {
    const out: PositionByPlayer = {};
    for (const sl of initialStatLines) {
      if (sl.positionPlayed) out[sl.playerId] = sl.positionPlayed;
    }
    if (persisted?.positions) {
      for (const [k, v] of Object.entries(persisted.positions)) out[k] = v;
    }
    return out;
  }, [initialStatLines, persisted]);

  const [onCourt, setOnCourt] = useState<string[]>(
    persisted?.onCourt ?? [],
  );
  const [positions, setPositions] =
    useState<PositionByPlayer>(initialPositions);
  const [setIdx, setSetIdx] = useState<number>(persisted?.setIdx ?? 0);
  const [sets, setSets] = useState<SetScore[]>(
    persisted?.sets && persisted.sets.length > 0
      ? persisted.sets
      : [{ us: 0, them: 0 }],
  );
  const [rotation, setRotation] = useState<number>(persisted?.rotation ?? 1);
  const [serving, setServing] = useState<"us" | "them">(
    persisted?.serving ?? "us",
  );
  const [undoStack, setUndoStack] = useState<UndoEntry[]>(
    persisted?.undo ?? [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [offline, setOffline] = useState<boolean>(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [queueSize, setQueueSize] = useState<number>(
    typeof window !== "undefined" ? readWal(matchId).length : 0,
  );

  const [showLineup, setShowLineup] = useState<boolean>(
    (persisted?.onCourt?.length ?? 0) === 0,
  );

  // Persist all the screen state whenever it changes.
  useEffect(() => {
    writePersisted(matchId, {
      onCourt,
      positions,
      setIdx,
      sets,
      rotation,
      serving,
      undo: undoStack,
    });
  }, [matchId, onCourt, positions, setIdx, sets, rotation, serving, undoStack]);

  // Track online/offline transitions to drive the WAL replay.
  const refreshQueueSize = useCallback(() => {
    setQueueSize(readWal(matchId).length);
  }, [matchId]);

  const flushWal = useCallback(async () => {
    const pending = readWal(matchId);
    for (const entry of pending) {
      try {
        await sendWalEntry(matchId, entry);
        removeWal(matchId, entry.id);
      } catch {
        // Stop and retry on the next online event.
        break;
      }
    }
    refreshQueueSize();
  }, [matchId, refreshQueueSize]);

  useEffect(() => {
    function onlineHandler() {
      setOffline(false);
      void flushWal();
    }
    function offlineHandler() {
      setOffline(true);
    }
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    // Replay on first mount in case the user reloaded with queued items.
    void flushWal();
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [flushWal]);

  // ---- Derived ----
  const onCourtSet = useMemo(() => new Set(onCourt), [onCourt]);
  const bench = useMemo(
    () => roster.filter((p) => !onCourtSet.has(p.id)).map((p) => p.id),
    [roster, onCourtSet],
  );
  const playerById = useCallback(
    (id: string) => roster.find((p) => p.id === id) ?? null,
    [roster],
  );
  const selectedPlayer = selectedId ? playerById(selectedId) : null;
  const selectedPosition = selectedId
    ? (positions[selectedId] ??
        playerById(selectedId)?.primaryPosition ??
        null)
    : null;

  const currentScore = sets[setIdx] ?? { us: 0, them: 0 };

  // ---- Toast helper ----
  const toastTimer = useRef(0);
  function pushToast(text: string, tone: ToastMsg["tone"] = "success") {
    const id = String(++toastTimer.current);
    setToasts((prev) => [...prev, { id, text, tone }]);
  }
  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // ---- Score handling ----
  function handleScore(who: "us" | "them", delta: 1 | -1) {
    setSets((prev) => {
      const next = prev.map((s, i) =>
        i === setIdx
          ? {
              ...s,
              [who]: Math.max(0, s[who] + delta),
            }
          : s,
      );
      return next;
    });
    // Auto-advance rotation only on side-out: we scored while they were serving.
    if (who === "us" && delta === 1 && serving === "them") {
      setServing("us");
      setRotation((r) => (r % 6) + 1);
    } else if (who === "them" && delta === 1 && serving === "us") {
      setServing("them");
    }
  }
  function handleSetChange(idx: number) {
    setSetIdx(idx);
  }
  function handleAddSet() {
    setSets((prev) => [...prev, { us: 0, them: 0 }]);
    setSetIdx(sets.length);
  }

  function handleRotation(delta: 1 | -1) {
    setRotation((r) => {
      let next = r + delta;
      if (next < 1) next = 6;
      if (next > 6) next = 1;
      return next;
    });
  }

  // ---- Lineup handling ----
  async function applyLineup(
    newOnCourt: string[],
    newPositions: PositionByPlayer,
  ) {
    setOnCourt(newOnCourt);
    setPositions({ ...positions, ...newPositions });
    setShowLineup(false);
    // Post to API so positionPlayed is stored even if no stat is ever recorded.
    try {
      await fetch(`/api/matches/${matchId}/lineup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: newOnCourt.map((id) => ({
            playerId: id,
            positionPlayed: newPositions[id] ?? playerById(id)?.primaryPosition,
          })),
        }),
      });
    } catch {
      pushToast("Lineup queued — will sync when online", "info");
    }
  }

  function handleSub(benchId: string, courtId: string, position: Position) {
    setOnCourt((prev) =>
      prev.map((id) => (id === courtId ? benchId : id)),
    );
    setPositions((prev) => ({ ...prev, [benchId]: position }));
    // Tell the server so positionPlayed is locked in for the new player.
    void fetch(`/api/matches/${matchId}/lineup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{ playerId: benchId, positionPlayed: position }],
      }),
    });
    pushToast(`Subbed ${playerById(benchId)?.name} in`, "info");
  }

  // ---- Stat recording with WAL ----
  async function processWalEntry(entry: WalEntry) {
    appendWal(matchId, entry);
    refreshQueueSize();
    try {
      await sendWalEntry(matchId, entry);
      removeWal(matchId, entry.id);
      refreshQueueSize();
    } catch {
      // Leave in queue — flushed when online event fires.
      setOffline(true);
    }
  }

  async function handleAction(action: StatActionId) {
    if (!selectedPlayer) return;
    const playerId = selectedPlayer.id;
    const playerName = selectedPlayer.name;
    const walId = newWalId();
    const walEntry: WalEntry = {
      id: walId,
      kind: "record",
      playerId,
      action,
      value: 1,
      ts: Date.now(),
    };

    // Optimistic UI — push to undo stack immediately and clear selection.
    setUndoStack((prev) => {
      const next = [...prev, { id: walId, playerId, playerName, action, ts: walEntry.ts }];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    setSelectedId(null);
    pushToast(`${playerName} +1 ${STAT_ACTION_LABELS[action]}`, "success");

    await processWalEntry(walEntry);
  }

  async function handleUndo(entryId: string) {
    const entry = undoStack.find((e) => e.id === entryId);
    if (!entry) return;
    setUndoStack((prev) => prev.filter((e) => e.id !== entryId));
    pushToast(
      `Undone: ${entry.playerName} +1 ${STAT_ACTION_LABELS[entry.action]}`,
      "info",
    );
    const walEntry: WalEntry = {
      id: newWalId(),
      kind: "undo",
      playerId: entry.playerId,
      action: entry.action,
      value: 1,
      ts: Date.now(),
    };
    await processWalEntry(walEntry);
  }

  // ---- End match ----
  const [ending, setEnding] = useState(false);
  async function endMatch() {
    if (ending) return;
    setEnding(true);
    // Count sets we won/lost from local score tracking.
    let setsWon = 0;
    let setsLost = 0;
    for (const s of sets) {
      if (s.us > s.them) setsWon += 1;
      else if (s.them > s.us) setsLost += 1;
    }
    const result =
      setsWon > setsLost ? "WIN" : setsWon < setsLost ? "LOSS" : "DRAW";
    try {
      // Make sure the WAL is fully drained first so the review page sees everything.
      await flushWal();
      await fetch(`/api/matches/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setsWon, setsLost, result }),
      });
      router.push(`/match/${matchId}/review`);
      router.refresh();
    } catch {
      setEnding(false);
      pushToast("Could not finalize match — check connection.", "danger");
    }
  }

  return (
    <div className="pb-32 lg:pb-20">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: team.name, href: `/team/${team.id}` },
          {
            label: tournament.name,
            href: `/team/${team.id}/tournament/${tournament.id}`,
          },
          { label: `Match ${match.matchNumber} · vs ${match.opponent}` },
        ]}
      />

      <header className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            vs {match.opponent}
          </h1>
          <div className="text-xs text-slate-500">
            Stats auto-save · Last save{" "}
            {queueSize > 0 ? `(${queueSize} pending)` : "✓"}
          </div>
        </div>
        <button
          type="button"
          onClick={endMatch}
          disabled={ending}
          className="btn-secondary text-sm"
        >
          {ending ? "Finalizing…" : "End match"}
        </button>
      </header>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Scoreboard
            opponent={match.opponent}
            setIdx={setIdx}
            setCount={sets.length}
            us={currentScore.us}
            them={currentScore.them}
            rotation={rotation}
            serving={serving}
            offline={offline}
            syncQueueSize={queueSize}
            onSetChange={handleSetChange}
            onAddSet={handleAddSet}
            onScore={handleScore}
            onRotation={handleRotation}
            onServingToggle={() =>
              setServing((s) => (s === "us" ? "them" : "us"))
            }
          />
        </div>

        <PlayerGrid
          roster={roster}
          onCourt={onCourt}
          bench={bench}
          selectedId={selectedId}
          positions={positions}
          onSelect={(id) =>
            setSelectedId((prev) => (prev === id ? null : id))
          }
          onSub={handleSub}
          onOpenLineup={() => setShowLineup(true)}
        />

        <ActionPanel
          player={selectedPlayer}
          positionPlayed={selectedPosition}
          onAction={handleAction}
        />
      </div>

      <UndoBar entries={undoStack} onUndo={handleUndo} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <LineupModal
        open={showLineup}
        roster={roster}
        initialOnCourt={onCourt}
        initialPositions={positions}
        onClose={() => {
          if (onCourt.length > 0) setShowLineup(false);
        }}
        onConfirm={applyLineup}
      />
    </div>
  );
}
