"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Match, Position, StatLine } from "@prisma/client";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { STAT_ACTION_LABELS, type StatActionId } from "@/lib/stat-actions";
import { applyRally, rotateLineup, servingAssertionFor } from "@/lib/rotation";
import { POSITION_GROUP } from "@/lib/positions";
import {
  bestOfFor,
  computeSetWinChance,
  matchTally,
  setRulesFor,
  setWinner,
  type BestOf,
} from "@/engine/win-probability";
import { Modal } from "@/components/ui/Modal";
import { FORMAT_LABEL, MatchFormatChoice } from "@/components/match/MatchFormatChoice";
import { EndPrompt } from "./EndPrompt";
import { Scoreboard } from "./Scoreboard";
import { PlayerGrid } from "./PlayerGrid";
import { ActionPanel, actionButtonLabel } from "./ActionPanel";
import { UndoBar } from "./UndoBar";
import { LineupModal } from "./LineupModal";
import { NoLineupState } from "./NoLineupState";
import { canEnd, canRecord, matchState } from "@/lib/match-state";
import { SetStartModal } from "./SetStartModal";
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
  // false = no-positions team: no libero swap, no dimmed buttons, no
  // position pickers. Rotation and serve receive tracking work as usual.
  usesPositions?: boolean;
  // Team's per-rally win rate from past set results (null = no history);
  // seeds the live set win probability.
  historicalRallyRate?: number | null;
}

// [us, them] after every point, per set index.
type PointLog = Record<number, [number, number][]>;

const LS_PREFIX = "spikeledger:entry:";

// Which stat actions auto-update the scoreboard. A kill/ace/block wins us the
// rally. Every red error button means "this player's mistake lost the rally",
// so all six hand the point to the opponent, through the same side-out logic
// as Attack err. SR grades, assists, and digs don't end a rally, so they never
// move the score.
const SCORES_US = new Set<StatActionId>(["KILL", "ACE", "BLOCK"]);
const SCORES_THEM = new Set<StatActionId>(["S_ERR", "A_ERR", "NET_ERR", "SET_ERR", "DIG_ERR", "GEN_ERR"]);

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
  // Indices of sets whose serve/rotation start the coach has already set, so we
  // don't re-prompt on reload or when flipping back to an earlier set tab.
  configuredSets: number[];
  // Score after every point in each set - drives the set win probability
  // sparkline and is synced to the server for the parent view.
  pointLog?: PointLog;
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
  usesPositions = true,
  historicalRallyRate = null,
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
  // Sets whose serve/rotation start has been set by the coach.
  const [configuredSets, setConfiguredSets] = useState<number[]>([]);
  const [showSetStart, setShowSetStart] = useState<boolean>(false);
  const [pointLog, setPointLog] = useState<PointLog>({});
  // Best of 3 or 5. A match saved before formats existed reads as best of 5,
  // the rule the app always used (see win-probability.ts).
  const [bestOf, setBestOf] = useState<BestOf>(bestOfFor(match.bestOf));
  const [showFormat, setShowFormat] = useState(false);
  // Start match bookkeeping (see notifyStart).
  const startSentRef = useRef(false);
  const pendingStartRef = useRef<string[] | null>(null);

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
  // Bumped each time the serve switches so the Scoreboard highlights "Serving".
  const [servingFlash, setServingFlash] = useState<number>(0);
  // The page renders from this rather than from whatever is in memory. Before
  // a lineup exists there is no live match to render, and nothing that writes
  // to one is put on the screen.
  const entryState = matchState({
    result: match.result ?? null,
    onCourtCount: onCourt.length,
    pointsScored: sets.reduce((n, s) => n + s.us + s.them, 0),
    statCount: initialStatLines.length,
  });
  const tournamentHref = `/team/${team.id}/tournament/${tournament.id}`;

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
      if (persisted.configuredSets) setConfiguredSets(persisted.configuredSets);
      if (persisted.pointLog) setPointLog(persisted.pointLog);
      // Keep the lineup modal up only if there's still no lineup set, and
      // never on a match that has already been finalised.
      const hasLineup = (persisted.onCourt?.length ?? 0) > 0;
      setShowLineup(!hasLineup && !match.result);
      // A saved lineup means Start match already ran on this device.
      if (hasLineup) startSentRef.current = true;
      // Once the lineup exists but the current set's serve/rotation start was
      // never set, prompt for it so auto-rotation begins from the truth.
      const curSet = persisted.setIdx ?? 0;
      if (hasLineup && !(persisted.configuredSets ?? []).includes(curSet)) {
        setShowSetStart(true);
      }
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
      configuredSets,
      pointLog,
    });
  }, [hydrated, matchId, onCourt, positions, setIdx, sets, rotation, serving, undoStack, opponentErrors, liberoSwap, configuredSets, pointLog]);

  // ---- Court state sync ----
  // Who is on court, per set, so the parent view can say whether a child is
  // playing right now. A substitution only tells the server about the player
  // coming ON, so without this the server never learns that anyone came off.
  // Fire and forget: the next lineup change resends the whole list, so a
  // dropped request on gym Wi-Fi corrects itself rather than needing a queue.
  const courtSyncRef = useRef<string>("");
  useEffect(() => {
    if (!hydrated || onCourt.length === 0) return;
    const setNumber = setIdx + 1;
    const signature = `${setNumber}:${onCourt.join(",")}`;
    if (courtSyncRef.current === signature) return;
    courtSyncRef.current = signature;
    void fetch(`/api/matches/${matchId}/court`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setNumber,
        onCourt,
        roster: roster.map((p) => p.id),
      }),
    }).catch(() => {
      // Let the next change retry; a stale signature would block that.
      courtSyncRef.current = "";
    });
  }, [hydrated, matchId, onCourt, setIdx, roster]);

  // ---- Point log + live score sync ----
  // Every time the current set's score changes, append it to that set's log
  // (manual corrections included - the log is the sequence of states, not
  // of rallies). Then push the whole set to the server, debounced, so the
  // parent view and the set win probability follow point by point.
  const currentUs = sets[setIdx]?.us ?? 0;
  const currentThem = sets[setIdx]?.them ?? 0;
  useEffect(() => {
    if (!hydrated) return;
    setPointLog((prev) => {
      const log = prev[setIdx] ?? [];
      const last = log[log.length - 1];
      if (last && last[0] === currentUs && last[1] === currentThem) return prev;
      const next = [...log, [currentUs, currentThem] as [number, number]];
      return { ...prev, [setIdx]: next.length > 150 ? next.slice(next.length - 150) : next };
    });
  }, [hydrated, setIdx, currentUs, currentThem]);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    // No lineup means no match yet. Syncing a 0-0 score here is what put a set
    // row on matches that were never started, and put a phantom scoreboard in
    // front of parents watching them.
    if (!canRecord(entryState)) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    const history = pointLog[setIdx] ?? [];
    syncTimer.current = setTimeout(() => {
      void fetch(`/api/matches/${matchId}/score`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setNumber: setIdx + 1, us: currentUs, them: currentThem, history }),
      }).catch(() => undefined);
    }, 400);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [hydrated, matchId, setIdx, currentUs, currentThem, pointLog, entryState]);

  // Set win probability for the current set, recomputed on every point.
  const winChance = useMemo(
    () =>
      computeSetWinChance(pointLog[setIdx] ?? [[currentUs, currentThem]], {
        setNumber: setIdx + 1,
        bestOf,
        historicalRate: historicalRallyRate,
      }),
    [pointLog, setIdx, currentUs, currentThem, historicalRallyRate, bestOf],
  );

  // Track online/offline transitions to drive the WAL replay.
  const refreshQueueSize = useCallback(() => {
    setQueueSize(readWal(matchId).length);
  }, [matchId]);

  // Every send to the server runs through one queue, in order, so an undo can
  // never overtake the record it cancels.
  const sendChain = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    const run = sendChain.current.then(job, job);
    sendChain.current = run.catch(() => undefined);
    return run;
  }, []);

  // Set scores changed off screen (an undo in another set). The live sync only
  // follows the set on screen, so these are sent here, and resent until they land.
  const pendingSetSync = useRef<Map<number, { us: number; them: number; history: [number, number][] }>>(new Map());
  const flushSetSync = useCallback(async () => {
    for (const [idx, body] of [...pendingSetSync.current]) {
      try {
        const res = await fetch(`/api/matches/${matchId}/score`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setNumber: idx + 1, ...body }),
        });
        if (!res.ok) throw new Error(String(res.status));
        if (pendingSetSync.current.get(idx) === body) pendingSetSync.current.delete(idx);
      } catch {
        break; // retried on the next online event, and before End match
      }
    }
  }, [matchId]);

  const flushWal = useCallback(
    () =>
      enqueue(async () => {
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
      }),
    [enqueue, matchId, refreshQueueSize],
  );

  useEffect(() => {
    function onlineHandler() {
      setOffline(false);
      void flushWal();
      void flushSetSync();
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
  }, [flushWal, flushSetSync]);

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
  function flashServing() {
    setServingFlash((n) => n + 1);
  }
  // Physically shift the on-court formation one spot. Forward (+1) is the
  // clockwise volleyball rotation a side-out triggers (P2->P1, P3->P2, ...,
  // P1->P6); -1 reverses it for a manual correction. onCourt index i is court
  // position i+1, so a forward rotation is a left-shift of the array.
  function rotateCourt(dir: 1 | -1) {
    setOnCourt((prev) => rotateLineup(prev, dir));
  }
  function bumpScore(who: "us" | "them", delta: 1 | -1) {
    setSets((prev) =>
      prev.map((s, i) =>
        i === setIdx ? { ...s, [who]: Math.max(0, s[who] + delta) } : s,
      ),
    );
  }

  // Manual scoreboard tap/hold: a pure score correction. Per the rotation
  // rules, manual score adjustments must NOT move serve or rotation - only
  // stat actions and the opponent-error button do that (see `applyPoint`).
  function handleManualScore(who: "us" | "them", delta: 1 | -1) {
    bumpScore(who, delta);
  }

  // A real won rally from a stat action or the opponent-error button: score the
  // point AND run the side-out logic. `servingBefore` lets a caller assert who
  // served the rally start - an ace or serve error proves we were serving, so
  // it corrects a wrong toggle without faking a rotation.
  function applyPoint(who: "us" | "them", servingBefore?: "us" | "them") {
    bumpScore(who, 1);
    flashScore(who);
    const outcome = applyRally({ serving, rotation }, who, servingBefore);
    if (outcome.serving !== serving) flashServing();
    setServing(outcome.serving);
    setRotation(outcome.rotation);
    if (outcome.rotated) {
      flashRotation();
      rotateCourt(1); // side-out: everyone slides one spot clockwise
    }
    return outcome;
  }
  function handleSetChange(idx: number) {
    setSetIdx(idx);
  }
  function handleAddSet() {
    const newIdx = sets.length;
    setSets((prev) => [...prev, { us: 0, them: 0 }]);
    setSetIdx(newIdx);
    // A new set resets rotation tracking - ask the coach how it starts.
    setShowSetStart(true);
  }

  // The coach sets who serves first and the opening rotation for the current
  // set. This is the only place a "start" sets rotation directly (no flash -
  // it's a deliberate setup, not an auto-advance).
  function handleSetStartConfirm(
    startServing: "us" | "them",
    startRotation: number,
  ) {
    setServing(startServing);
    setRotation(startRotation);
    setConfiguredSets((prev) =>
      prev.includes(setIdx) ? prev : [...prev, setIdx],
    );
    setShowSetStart(false);
  }

  function handleRotation(delta: 1 | -1) {
    setRotation((r) => {
      let next = r + delta;
      if (next < 1) next = 6;
      if (next > 6) next = 1;
      return next;
    });
    // Keep the physical formation locked to the rotation number.
    rotateCourt(delta);
  }

  function handleServingToggle() {
    setServing((s) => (s === "us" ? "them" : "us"));
    flashServing();
  }

  // ---- Lineup handling ----
  // ---- Start match: alert parents of the starters ----
  // The server decides who actually gets alerted (only starters' parents, one
  // alert per match, nothing once play is underway); this just reports it.
  const notifyStart = useCallback(
    async (playerIds: string[]) => {
      if (playerIds.length === 0) return;
      try {
        const res = await fetch(`/api/matches/${matchId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerIds }),
        });
        startSentRef.current = true;
        pendingStartRef.current = null;
        if (!res.ok) return;
        const data = (await res.json()) as { notified?: number };
        const n = data.notified ?? 0;
        if (n > 0) pushToast(`${n} ${n === 1 ? "parent" : "parents"} notified`, "info");
      } catch {
        // Offline: try again when the connection is back.
        pendingStartRef.current = [...new Set([...(pendingStartRef.current ?? []), ...playerIds])];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId],
  );
  useEffect(() => {
    const retry = () => {
      if (pendingStartRef.current) void notifyStart(pendingStartRef.current);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [notifyStart]);

  async function applyLineup(
    newOnCourt: string[],
    newPositions: PositionByPlayer,
  ) {
    setOnCourt(newOnCourt);
    setPositions({ ...positions, ...newPositions });
    setShowLineup(false);
    // First lineup of a set flows straight into the serve/rotation start prompt
    // so auto-rotation knows whether we or the opponent open serving.
    if (!configuredSets.includes(setIdx)) setShowSetStart(true);
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
    void notifyStart(newOnCourt);
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

  // ---- Correction: two players already on court change places ----
  // This is not a substitution. Nobody enters or leaves the match, so the
  // rotation number, the serving flag and the score are all untouched - only
  // the order of `onCourt`, which is who is standing in which slot.
  //
  // `positions` is not touched either: a position played is a role the player
  // carries with them, not a property of the slot they stand in.
  //
  // An active libero pairing survives. handleLiberoOut finds the libero by id
  // wherever they are standing, so the player they replaced still comes back
  // in the right place.
  //
  // Swapping two entries in an array is its own inverse, so tapping the same
  // pair again restores the previous order exactly.
  function handleSwap(aId: string, bId: string) {
    if (aId === bId) return;
    setOnCourt((prev) => {
      const i = prev.indexOf(aId);
      const j = prev.indexOf(bId);
      if (i < 0 || j < 0) return prev;
      const next = [...prev];
      next[i] = bId;
      next[j] = aId;
      return next;
    });
    pushToast(
      `${playerById(aId)?.name} and ${playerById(bId)?.name} changed places`,
      "info",
    );
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
    // A libero on court before the first rally is a starter too.
    const firstSet = sets[0];
    if (setIdx === 0 && firstSet && firstSet.us + firstSet.them === 0) {
      if (pendingStartRef.current) {
        pendingStartRef.current = [...new Set([...pendingStartRef.current, liberoId])];
      } else if (startSentRef.current) {
        void notifyStart([liberoId]);
      }
    }
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
    await enqueue(async () => {
      // A replay that ran first has already sent it.
      if (!readWal(matchId).some((e) => e.id === entry.id)) return;
      try {
        await sendWalEntry(matchId, entry);
        removeWal(matchId, entry.id);
        refreshQueueSize();
      } catch {
        // Leave in queue - flushed when online event fires.
        setOffline(true);
      }
    });
  }

  // Take a stat back on the server. If the record never got there (still in
  // the queue, e.g. offline), drop it instead: there is nothing to undo.
  async function undoStat(recordId: string, undo: WalEntry) {
    await sendChain.current;
    if (readWal(matchId).some((e) => e.id === recordId)) {
      removeWal(matchId, recordId);
      refreshQueueSize();
      return;
    }
    await processWalEntry(undo);
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

    setSelectedId(null);
    pushToast(`${playerName} +1 ${STAT_ACTION_LABELS[action]}`, "success");

    // Auto-score + side-out: most rally-ending actions move the scoreboard and
    // drive rotation so the coach doesn't have to tap twice. An ace or serve
    // error only happens on our serve, so assert we were serving - this fixes
    // a wrong toggle and keeps the side-out math honest.
    const servingAssert = servingAssertionFor(action);
    const scorer = SCORES_US.has(action) ? "us" : SCORES_THEM.has(action) ? "them" : null;
    const entry: UndoEntry = { id: walId, playerId, playerName, action, ts: walEntry.ts, setIdx, inPlay: sets.length - 1, point: null };
    if (scorer) {
      // Remember what this action did, so undo can reverse exactly that.
      const outcome = applyPoint(scorer, servingAssert);
      entry.point = scorer;
      entry.servingBefore = serving;
      entry.servingAfter = outcome.serving;
      entry.rotated = outcome.rotated;
    } else if (servingAssert && servingAssert !== serving) {
      // Proof of who served that did not end the rally: a serve receive. It
      // scores nothing and rotates nobody, but it does settle who was serving,
      // so the next rally-ending action gets the side-out math right.
      setServing(servingAssert);
      flashServing();
    }
    // Optimistic UI - the undo list updates at once.
    setUndoStack((prev) => {
      const next = [...prev, entry];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });

    await processWalEntry(walEntry);
  }

  // ---- Opponent error: a point for us, not credited to any player ----
  function handleOpponentError() {
    const next = opponentErrors + 1;
    setOpponentErrors(next);
    // A point for us off the opponent's mistake. If they were serving this is a
    // side-out (rotate + take serve); if we were serving we just hold serve.
    const outcome = applyPoint("us");
    // On the undo list like any other action, so undo stays strictly in order.
    const entry: UndoEntry = {
      id: newWalId(), playerId: "", playerName: "", action: "OPP_ERR", ts: Date.now(),
      setIdx, inPlay: sets.length - 1, point: "us",
      servingBefore: serving, servingAfter: outcome.serving, rotated: outcome.rotated,
    };
    setUndoStack((prev) => {
      const next = [...prev, entry];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    pushToast("Opponent error - point for us", "success");
    // Persist the running count on the match. Idempotent (absolute value), so
    // it's safe to fire-and-forget; if offline it'll be resent at End match.
    void fetch(`/api/matches/${matchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opponentErrors: next }),
    }).catch(() => undefined);
  }

  // ---- Undo: reverse everything one action did, newest first ----
  // The stat, the point it gave (to either team), the serve and the rotation.
  // Only that action's point comes off, so plus/minus changes the coach made
  // by hand since then stay. It asks first when the action's set has ended,
  // or the whole match has.
  const [confirmUndo, setConfirmUndo] = useState<UndoEntry | null>(null);
  // Serve and rotation belong to the set being played; put them back only if
  // that set is still the one in play.
  const restoresServe = (e: UndoEntry) => (e.inPlay ?? e.setIdx) === sets.length - 1;
  function handleUndo(entryId: string) {
    const entry = undoStack[undoStack.length - 1];
    if (!entry || entry.id !== entryId) return; // strictly in order
    const setEnded = entry.setIdx !== undefined && entry.setIdx < sets.length - 1;
    if (entryState === "ended" || setEnded) {
      setConfirmUndo(entry);
      return;
    }
    void performUndo(entry);
  }

  async function performUndo(entry: UndoEntry) {
    setConfirmUndo(null);
    setUndoStack((prev) => prev.filter((e) => e.id !== entry.id));
    const matchEnded = entryState === "ended";
    const who = entry.playerName ? `, ${entry.playerName}` : "";
    let scoreLine = "";
    if (matchEnded) {
      // A finished match keeps its recorded score; only the stat comes off.
      scoreLine = " The final score stays as recorded.";
    } else if (entry.point && entry.setIdx !== undefined && sets[entry.setIdx]) {
      const idx = entry.setIdx;
      const was = sets[idx];
      const now = { ...was, [entry.point]: Math.max(0, was[entry.point] - 1) };
      setSets((prev) => prev.map((s, i) => (i === idx ? now : s)));
      scoreLine = ` Score ${now.us}-${now.them}.`;
      if (restoresServe(entry)) {
        // A serve the coach has changed by hand since then is theirs, and stays.
        if (entry.rotated) handleRotation(-1);
        if (entry.servingBefore && entry.servingAfter && serving === entry.servingAfter && entry.servingBefore !== serving) {
          setServing(entry.servingBefore);
          flashServing();
        }
      }
      if (idx !== setIdx && canRecord(entryState)) {
        // Not the set on screen: the live sync won't see it, so send it here.
        const history = [...(pointLog[idx] ?? []), [now.us, now.them] as [number, number]].slice(-150);
        setPointLog((prev) => ({ ...prev, [idx]: history }));
        pendingSetSync.current.set(idx, { us: now.us, them: now.them, history });
        void flushSetSync();
      }
    }
    pushToast(`Undone: ${actionButtonLabel(entry.action)}${who}.${scoreLine}`, "info");

    if (entry.action === "OPP_ERR") {
      const next = Math.max(0, opponentErrors - 1);
      setOpponentErrors(next);
      void fetch(`/api/matches/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentErrors: next }),
      }).catch(() => undefined);
      return;
    }
    await undoStat(entry.id, {
      id: newWalId(),
      kind: "undo",
      playerId: entry.playerId,
      action: entry.action,
      value: 1,
      ts: Date.now(),
    });
  }

  // ---- Ending a set and the match ----
  // One rule decides every set and the match (win-probability.ts), the same
  // one the win chance and the parent view use. The coach always decides:
  // a winning score only asks, and nothing ends by itself.
  const MAX_SETS = 5;
  const isLatestSet = setIdx === sets.length - 1;
  const currentWinner = setWinner(currentUs, currentThem, setRulesFor(setIdx + 1, bestOf));
  const tally = matchTally(sets, bestOf);
  const [ending, setEnding] = useState(false);
  const [confirmEndSet, setConfirmEndSet] = useState(false);
  const [confirmEndMatch, setConfirmEndMatch] = useState<string | null>(null);

  // "Not yet" on the set question holds only while the score stays put: once
  // it moves, a winning score asks again.
  const setPromptKey = `${setIdx}:${currentUs}-${currentThem}`;
  const [dismissedSetPrompt, setDismissedSetPrompt] = useState<string | null>(null);
  useEffect(() => {
    setDismissedSetPrompt((d) => (d && d !== setPromptKey ? null : d));
  }, [setPromptKey]);

  // The match question is asked when a set is ended, and stands only while
  // nothing has changed since. Its wording is worked out from the live score,
  // so a point fixed afterwards can never leave an old "Match won" on screen.
  const matchStateKey = `${bestOf}|${sets.length}|${setIdx}|${currentUs}-${currentThem}`;
  const [matchPromptKey, setMatchPromptKey] = useState<string | null>(null);
  // Any change after the set was ended (a point fixed, another tab, the
  // format) withdraws the question; a winning score then asks about the set
  // again first.
  useEffect(() => {
    setMatchPromptKey((k) => (k && k !== matchStateKey ? null : k));
  }, [matchStateKey]);
  const showMatchPrompt =
    !ending &&
    canRecord(entryState) &&
    matchPromptKey === matchStateKey &&
    (tally.winner !== null || sets.length >= MAX_SETS);
  const showSetPrompt =
    !ending &&
    canRecord(entryState) &&
    isLatestSet &&
    currentWinner !== null &&
    !showMatchPrompt &&
    dismissedSetPrompt !== setPromptKey;
  const matchMessage =
    tally.winner === "us"
      ? `Match won ${tally.won}-${tally.lost}. End match?`
      : tally.winner === "them"
        ? `Match lost ${tally.won}-${tally.lost}. End match?`
        : `All ${sets.length} sets played, ${tally.won}-${tally.lost}. End match?`;

  // The End set button. A set that isn't won yet asks first.
  function requestEndSet() {
    if (currentWinner) endSet();
    else setConfirmEndSet(true);
  }
  function endSet() {
    setConfirmEndSet(false);
    // A won match, or no room for another set: ask about the match instead.
    if (matchTally(sets, bestOf).winner || sets.length >= MAX_SETS) {
      setMatchPromptKey(matchStateKey);
      return;
    }
    // The next set starts exactly as the "+" tab starts one: serve and rotation.
    handleAddSet();
  }

  // The End match button. An unfinished last set asks first; it will not
  // count for either team.
  function requestEndMatch() {
    const last = sets[sets.length - 1];
    const lastNumber = sets.length;
    const unfinished =
      last && last.us + last.them > 0 && !setWinner(last.us, last.them, setRulesFor(lastNumber, bestOf));
    if (unfinished) {
      setConfirmEndMatch(`Set ${lastNumber} is ${last.us}-${last.them} and not finished. End the match anyway?`);
      return;
    }
    void endMatch();
  }

  async function endMatch() {
    if (ending) return;
    setConfirmEndMatch(null);
    setMatchPromptKey(null);
    setEnding(true);
    // Only finished sets count, by the same rule as everywhere else. An
    // unfinished set counts for nobody.
    const { won: setsWon, lost: setsLost } = matchTally(sets, bestOf);
    const result =
      setsWon > setsLost ? "WIN" : setsWon < setsLost ? "LOSS" : "DRAW";
    try {
      // Make sure the WAL is fully drained first so the review page sees everything.
      await flushWal();
      await flushSetSync();
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

  // The format can change until the match ends; the server refuses it after.
  async function changeFormat(next: BestOf) {
    setShowFormat(false);
    if (next === bestOf) return;
    const previous = bestOf;
    setBestOf(next);
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestOf: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      pushToast(`Format: ${FORMAT_LABEL[next]}`, "info");
    } catch {
      setBestOf(previous);
      pushToast("Could not change the format - check connection.", "danger");
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
          <div className="eyebrow">{tournament.name}</div>
          <h1 className="mt-0.5 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
            vs {match.opponent}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {entryState === "ended" ? (
              // A match finished before formats existed never had one: say nothing.
              match.bestOf != null && (
                <span data-format-label className="rounded-full border border-slate-200 px-2 py-0.5 font-semibold text-slate-600">
                  {FORMAT_LABEL[bestOf]}
                </span>
              )
            ) : (
              <button
                type="button"
                data-format-button
                onClick={() => setShowFormat(true)}
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:border-slate-400"
                aria-label={`Match format: ${FORMAT_LABEL[bestOf]}. Tap to change.`}
              >
                {FORMAT_LABEL[bestOf]} · Change
              </button>
            )}
            <span>
              {queueSize > 0
                ? `Stats auto-save · ${queueSize} pending sync`
                : "Stats auto-save · all synced"}
            </span>
          </div>
        </div>
        {/* Ending a match that never began is what wrote the one phantom
            result in production: a score, a WIN, and no stats. */}
        {canEnd(entryState) && (
          <button
            type="button"
            onClick={requestEndMatch}
            disabled={ending}
            className="btn-secondary text-sm"
          >
            {ending ? "Finalizing…" : "End match"}
          </button>
        )}
      </header>

      {entryState === "ended" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-700">
            This match is finished. Anything you change here updates the record.
          </span>
          <Link href={`/match/${matchId}/review`} className="btn-secondary text-sm">
            Open the match report
          </Link>
        </div>
      )}

      {!canRecord(entryState) && entryState === "no_lineup" ? (
        <div className="mt-4">
          <NoLineupState
            onOpenLineup={() => setShowLineup(true)}
            backHref={tournamentHref}
            backLabel={`Back to ${tournament.name}`}
          />
        </div>
      ) : (
      <div className="mt-4 grid gap-3 md:grid-cols-2" data-match-state={entryState}>
        <div className="md:col-span-2">
          <Scoreboard
            teamName={team.name}
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
            servingFlash={servingFlash}
            winChance={winChance}
            onSetChange={handleSetChange}
            onAddSet={handleAddSet}
            onScore={handleManualScore}
            onRotation={handleRotation}
            onServingToggle={handleServingToggle}
            onEditStart={() => setShowSetStart(true)}
            onEndSet={isLatestSet && canRecord(entryState) && !ending ? requestEndSet : undefined}
          />
        </div>

        {showMatchPrompt ? (
          <div className="md:col-span-2">
            <EndPrompt
              kind="match"
              message={matchMessage}
              confirmLabel="End match"
              onConfirm={requestEndMatch}
              cancelLabel={sets.length >= MAX_SETS ? "Not yet" : "Play another set"}
              onCancel={() => {
                setMatchPromptKey(null);
                if (sets.length >= MAX_SETS) setDismissedSetPrompt(setPromptKey);
                else handleAddSet();
              }}
            />
          </div>
        ) : showSetPrompt ? (
          <div className="md:col-span-2">
            <EndPrompt
              kind="set"
              message={`Set ${setIdx + 1}: ${currentUs}-${currentThem}. End set?`}
              confirmLabel="End set"
              onConfirm={endSet}
              cancelLabel="Not yet"
              onCancel={() => setDismissedSetPrompt(setPromptKey)}
            />
          </div>
        ) : null}

        <PlayerGrid
          roster={roster}
          usesPositions={usesPositions}
          onCourt={onCourt}
          bench={bench}
          selectedId={selectedId}
          positions={positions}
          onSelect={(id) =>
            setSelectedId((prev) => (prev === id ? null : id))
          }
          onSub={handleSub}
          onSwap={handleSwap}
          onOpenLineup={() => setShowLineup(true)}
          liberoActive={liberoSwap !== null}
          onLiberoIn={handleLiberoIn}
          onLiberoOut={handleLiberoOut}
        />

        <ActionPanel
          player={selectedPlayer}
          positionPlayed={selectedPosition}
          restrictByPosition={usesPositions}
          // Slot 1 is the server; onCourt is kept in court order, so the index
          // is the slot. Null when the tapped player is somehow not on court,
          // and null means nothing is gated.
          slot={selectedId ? (onCourt.indexOf(selectedId) >= 0 ? onCourt.indexOf(selectedId) + 1 : null) : null}
          onFixCourt={() => setShowLineup(true)}
          onAction={handleAction}
          onOpponentError={handleOpponentError}
          opponentErrors={opponentErrors}
        />
      </div>
      )}

      <UndoBar entries={undoStack} onUndo={handleUndo} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <LineupModal
        open={showLineup}
        roster={roster}
        usesPositions={usesPositions}
        initialOnCourt={onCourt}
        initialPositions={positions}
        onClose={() => setShowLineup(false)}
        onCancel={() => router.push(tournamentHref)}
        onConfirm={applyLineup}
      />

      <Modal open={showFormat} onClose={() => setShowFormat(false)} title="Match format">
        <MatchFormatChoice value={bestOf} onChange={(n) => void changeFormat(n)} />
      </Modal>

      <Modal open={confirmEndSet} onClose={() => setConfirmEndSet(false)} title={`End set ${setIdx + 1}?`}>
        <p className="text-sm text-slate-700" data-confirm-end-set>
          Set {setIdx + 1} is {currentUs}-{currentThem} and not finished. End it anyway? It won&apos;t count for either team.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmEndSet(false)} className="btn-secondary">
            Keep playing
          </button>
          <button type="button" onClick={endSet} className="btn-primary">
            End set anyway
          </button>
        </div>
      </Modal>

      <Modal open={confirmEndMatch !== null} onClose={() => setConfirmEndMatch(null)} title="End the match?">
        <p className="text-sm text-slate-700" data-confirm-end-match>
          {confirmEndMatch} It won&apos;t count for either team.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmEndMatch(null)} className="btn-secondary">
            Keep playing
          </button>
          <button type="button" onClick={() => void endMatch()} className="btn-primary">
            End match anyway
          </button>
        </div>
      </Modal>

      <Modal
        open={confirmUndo !== null}
        onClose={() => setConfirmUndo(null)}
        title={entryState === "ended" ? "Undo a stat in a finished match?" : "Undo a stat from an ended set?"}
      >
        {confirmUndo && (
          <p className="text-sm text-slate-700" data-confirm-undo>
            {actionButtonLabel(confirmUndo.action)}
            {confirmUndo.playerName ? ` by ${confirmUndo.playerName}` : ""}
            {entryState === "ended"
              ? ` is from a match that has ended. Undoing it removes ${confirmUndo.action === "OPP_ERR" ? "it from the opponent error count" : "the stat"} only; the final score stays as recorded.`
              : ` was in set ${(confirmUndo.setIdx ?? 0) + 1}, which has ended. Undoing it removes ${confirmUndo.action === "OPP_ERR" ? "it from the opponent error count" : "the stat"}${
                  confirmUndo.point
                    ? ` and takes 1 point off ${confirmUndo.point === "us" ? team.name : match.opponent} in set ${(confirmUndo.setIdx ?? 0) + 1}`
                    : ""
                }. ${
                  confirmUndo.point && restoresServe(confirmUndo)
                    ? "The serve and rotation it changed go back too."
                    : "The serve and rotation of the set you are playing stay as they are."
                }`}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmUndo(null)} className="btn-secondary">
            Keep it
          </button>
          <button type="button" onClick={() => confirmUndo && void performUndo(confirmUndo)} className="btn-primary">
            Undo it
          </button>
        </div>
      </Modal>

      <SetStartModal
        open={showSetStart}
        setNumber={setIdx + 1}
        initialServing={serving}
        initialRotation={rotation}
        onConfirm={handleSetStartConfirm}
        onClose={() => setShowSetStart(false)}
      />
    </div>
  );
}
