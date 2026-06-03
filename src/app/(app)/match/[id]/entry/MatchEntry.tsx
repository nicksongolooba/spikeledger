"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match, Position, StatLine } from "@prisma/client";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { STAT_ACTION_LABELS, type StatActionId } from "@/lib/stat-actions";
import { POSITION_GROUP } from "@/lib/positions";
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
import type {
  LiberoSwap,
  PositionByPlayer,
  RosterPlayer,
  SetScore,
  UndoEntry,
} from "./types";

interface Props {
  match: Match;
  team: { id: string; name: string };
  tournament: { id: string; name: string };
  roster: RosterPlayer[];
  initialStatLines: StatLine[];
}

const LS_PREFIX = "spikeledger:entry:";

// Which stat actions auto-update the scoreboard. A kill/ace/block wins us the
// rally; the four error types hand the point to the opponent. SR grades,
// assists, and digs don't end a rally, so they never move the score.
const SCORES_US = new Set<StatActionId>(["KILL", "ACE", "BLOCK"]);
const SCORES_THEM = new Set<StatActionId>(["S_ERR", "A_ERR", "NET_ERR", "GEN_ERR"]);

interface PersistedState {
  onCourt: string[];
  positions: PositionByPlayer;
  setIdx: number;
  sets: SetScore[];
  rotation: number;
  serving: "us" | "them";
  undo: UndoEntry[];
  opponentErrors: number;
  liberoSwap: LiberoSwap | null;
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

  // ---- Initial state: SERVER-SAFE DEFAULTS ONLY ----
  // Never read localStorage / navigator / the WAL during render. They exist
  // only on the client, so seeding initial state from them makes the first
  // client render diverge from the server HTML. That hydration mismatch, in
  // production, leaves the whole screen (this lineup modal included) rendered
  // but inert - no click handlers attach. We restore the saved session in the
  // mount effect below, after the first render has matched the server.

  // Positions known from the DB - deterministic, so safe at first render.
  const dbPositions: PositionByPlayer = useMemo(() => {
    const out: PositionByPlayer = {};
    for (const sl of initialStatLines) {
      if (sl.positionPlayed) out[sl.playerId] = sl.positionPlayed;
    }
    return out;
  }, [initialStatLines]);

  const [onCourt, setOnCourt] = useState<string[]>([]);
  const [positions, setPositions] = useState<PositionByPlayer>(dbPositions);
  const [setIdx, setSetIdx] = useState<number>(0);
  const [sets, setSets] = useState<SetScore[]>([{ us: 0, them: 0 }]);
  const [rotation, setRotation] = useState<number>(1);
  const [serving, setServing] = useState<"us" | "them">("us");
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [opponentErrors, setOpponentErrors] = useState<number>(
    match.opponentErrors ?? 0,
  );
  // Active libero substitution from the quick LIB button (null = libero out).
  const [liberoSwap, setLiberoSwap] = useState<LiberoSwap | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [offline, setOffline] = useState<boolean>(false);
  const [queueSize, setQueueSize] = useState<number>(0);
  const [showLineup, setShowLineup] = useState<boolean>(true);
  // Bumped each auto-score so the Scoreboard can flash the side that scored.
  const [scoreFlash, setScoreFlash] = useState<{
    side: "us" | "them";
    nonce: number;
  } | null>(null);
  // Bumped each time the rotation auto-advances so the Scoreboard flashes R#.
  const [rotationFlash, setRotationFlash] = useState<number>(0);

  // Restore the saved session (localStorage + WAL + online status) AFTER the
  // first paint, so the initial client render matches the server. `hydrated`
  // gates the persist effect below so we don't overwrite the save with the
  // defaults before we've had a chance to read it.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const persisted = readPersisted(matchId);
    if (persisted) {
      if (persisted.onCourt) setOnCourt(persisted.onCourt);
      if (persisted.positions) {
        setPositions((prev) => ({ ...prev, ...persisted.positions }));
      }
      if (typeof persisted.setIdx === "number") setSetIdx(persisted.setIdx);
      if (persisted.sets && persisted.sets.length > 0) setSets(persisted.sets);
      if (typeof persisted.rotation === "number") setRotation(persisted.rotation);
      if (persisted.serving) setServing(persisted.serving);
      if (persisted.undo) setUndoStack(persisted.undo);
      if (typeof persisted.opponentErrors === "number") {
        setOpponentErrors(persisted.opponentErrors);
      }
      if (persisted.liberoSwap !== undefined) {
        setLiberoSwap(persisted.liberoSwap);
      }
      // Keep the lineup modal up only if there's still no lineup set.
      setShowLineup((persisted.onCourt?.length ?? 0) === 0);
    }
    if (typeof navigator !== "undefined") setOffline(!navigator.onLine);
    setQueueSize(readWal(matchId).length);
    setHydrated(true);
    // Run once per match, on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // Persist all the screen state whenever it changes - but not until the saved
  // session has been restored, or we'd overwrite it with the defaults.
  useEffect(() => {
    if (!hydrated) return;
    writePersisted(matchId, {
      onCourt,
      positions,
      setIdx,
      sets,
      rotation,
      serving,
      undo: undoStack,
      opponentErrors,
      liberoSwap,
    });
  }, [hydrated, matchId, onCourt, positions, setIdx, sets, rotation, serving, undoStack, opponentErrors, liberoSwap]);

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
  function flashScore(side: "us" | "them") {
    setScoreFlash((prev) => ({ side, nonce: (prev?.nonce ?? 0) + 1 }));
  }
  function flashRotation() {
    setRotationFlash((n) => n + 1);
  }
  // `servingBefore` lets a caller assert who was serving at the start of the
  // rally - e.g. an ace or serve error proves we were serving, even if the
  // toggle was wrong. When omitted we trust the current `serving` state.
  function handleScore(
    who: "us" | "them",
    delta: 1 | -1,
    servingBefore?: "us" | "them",
  ) {
    setSets((prev) =>
      prev.map((s, i) =>
        i === setIdx ? { ...s, [who]: Math.max(0, s[who] + delta) } : s,
      ),
    );
    // Only a won rally (+1) changes serve/rotation. A correction (-1) doesn't.
    if (delta !== 1) return;
    const wasServing = servingBefore ?? serving;
    if (who === "us" && wasServing === "them") {
      // Side-out won by us: take the serve and rotate one position.
      setServing("us");
      setRotation((r) => (r % 6) + 1);
      flashRotation();
    } else if (who === "them" && wasServing === "us") {
      // They side-out off our serve: they get the serve, we don't rotate.
      setServing("them");
    } else if (servingBefore && servingBefore !== serving) {
      // Serving team scored, but the toggle was wrong - correct it silently.
      setServing(servingBefore);
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
      pushToast("Lineup queued - will sync when online", "info");
    }
  }

  function persistPositionPlayed(playerId: string, position: Position) {
    void fetch(`/api/matches/${matchId}/lineup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{ playerId, positionPlayed: position }],
      }),
    }).catch(() => undefined);
  }

  function handleSub(benchId: string, courtId: string, position: Position) {
    setOnCourt((prev) =>
      prev.map((id) => (id === courtId ? benchId : id)),
    );
    setPositions((prev) => ({ ...prev, [benchId]: position }));
    // A regular sub that touches either side of an active libero swap voids the
    // pairing - the one-tap "libero out" would otherwise restore a stale player.
    if (
      liberoSwap &&
      (courtId === liberoSwap.liberoId ||
        courtId === liberoSwap.replacedId ||
        benchId === liberoSwap.liberoId ||
        benchId === liberoSwap.replacedId)
    ) {
      setLiberoSwap(null);
    }
    // Tell the server so positionPlayed is locked in for the new player.
    persistPositionPlayed(benchId, position);
    pushToast(`Subbed ${playerById(benchId)?.name} in`, "info");
  }

  // ---- Libero quick swap ----
  // Bring a libero in for an on-court player. Remembers who they replaced so
  // the next LIB tap can send that player straight back (libero out).
  function handleLiberoIn(liberoId: string, courtId: string) {
    const lib = playerById(liberoId);
    if (!lib) return;
    const replacedPosition =
      positions[courtId] ?? playerById(courtId)?.primaryPosition ?? lib.primaryPosition;
    setOnCourt((prev) => prev.map((id) => (id === courtId ? liberoId : id)));
    setPositions((prev) => ({ ...prev, [liberoId]: lib.primaryPosition }));
    setLiberoSwap({ liberoId, replacedId: courtId, replacedPosition });
    if (selectedId === courtId) setSelectedId(null);
    persistPositionPlayed(liberoId, lib.primaryPosition);
    pushToast(
      `Libero ${lib.name} in for ${playerById(courtId)?.name}`,
      "success",
    );
  }

  // Send the libero back out, restoring the exact player they replaced.
  function handleLiberoOut() {
    if (!liberoSwap) return;
    const { liberoId, replacedId, replacedPosition } = liberoSwap;
    setOnCourt((prev) => prev.map((id) => (id === liberoId ? replacedId : id)));
    setPositions((prev) => ({ ...prev, [replacedId]: replacedPosition }));
    setLiberoSwap(null);
    if (selectedId === liberoId) setSelectedId(null);
    persistPositionPlayed(replacedId, replacedPosition);
    pushToast(`${playerById(replacedId)?.name} back in for libero`, "info");
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
      // Leave in queue - flushed when online event fires.
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

    // Optimistic UI - push to undo stack immediately and clear selection.
    setUndoStack((prev) => {
      const next = [...prev, { id: walId, playerId, playerName, action, ts: walEntry.ts }];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    setSelectedId(null);
    pushToast(`${playerName} +1 ${STAT_ACTION_LABELS[action]}`, "success");

    // Auto-score: most rally-ending actions move the scoreboard so the coach
    // doesn't have to tap twice. They can still hold to correct an edge case.
    // An ace or serve error only happens on our serve, so assert we were
    // serving - this fixes the toggle and keeps the side-out math honest.
    const servingBefore =
      action === "ACE" || action === "S_ERR" ? "us" : undefined;
    if (SCORES_US.has(action)) {
      handleScore("us", 1, servingBefore);
      flashScore("us");
    } else if (SCORES_THEM.has(action)) {
      handleScore("them", 1, servingBefore);
      flashScore("them");
    }

    await processWalEntry(walEntry);
  }

  // ---- Opponent error: a point for us, not credited to any player ----
  function handleOpponentError() {
    const next = opponentErrors + 1;
    setOpponentErrors(next);
    handleScore("us", 1);
    flashScore("us");
    pushToast("Opponent error - point for us", "success");
    // Persist the running count on the match. Idempotent (absolute value), so
    // it's safe to fire-and-forget; if offline it'll be resent at End match.
    void fetch(`/api/matches/${matchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opponentErrors: next }),
    }).catch(() => undefined);
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
        body: JSON.stringify({ setsWon, setsLost, result, opponentErrors }),
      });
      router.push(`/match/${matchId}/review`);
      router.refresh();
    } catch {
      setEnding(false);
      pushToast("Could not finalize match - check connection.", "danger");
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
            flash={scoreFlash}
            rotationFlash={rotationFlash}
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
          liberoActive={liberoSwap !== null}
          onLiberoIn={handleLiberoIn}
          onLiberoOut={handleLiberoOut}
        />

        <ActionPanel
          player={selectedPlayer}
          positionPlayed={selectedPosition}
          onAction={handleAction}
          onOpponentError={handleOpponentError}
          opponentErrors={opponentErrors}
        />
      </div>

      <UndoBar entries={undoStack} onUndo={handleUndo} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <LineupModal
        open={showLineup}
        roster={roster}
        initialOnCourt={onCourt}
        initialPositions={positions}
        onClose={() => setShowLineup(false)}
        onConfirm={applyLineup}
      />
    </div>
  );
}
