// Write-ahead log persisted in localStorage. Every recorded/undone stat
// is appended here BEFORE we hit the API, then drained when the request
// resolves. On page load, anything still in the log is replayed.
// This is what makes the page survive flaky gym WiFi and browser crashes.

import type { StatActionId } from "@/lib/stat-actions";

export type WalKind = "record" | "undo";

export interface WalEntry {
  id: string; // client-generated, used to dedupe replays
  kind: WalKind;
  playerId: string;
  action: StatActionId;
  value: number;
  ts: number;
}

const KEY_PREFIX = "spikeledger:wal:";

function key(matchId: string) {
  return KEY_PREFIX + matchId;
}

function safeParse(raw: string | null): WalEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WalEntry[]) : [];
  } catch {
    return [];
  }
}

export function readWal(matchId: string): WalEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(key(matchId)));
}

export function appendWal(matchId: string, entry: WalEntry) {
  if (typeof window === "undefined") return;
  const existing = readWal(matchId);
  existing.push(entry);
  window.localStorage.setItem(key(matchId), JSON.stringify(existing));
}

export function removeWal(matchId: string, entryId: string) {
  if (typeof window === "undefined") return;
  const existing = readWal(matchId).filter((e) => e.id !== entryId);
  if (existing.length === 0) {
    window.localStorage.removeItem(key(matchId));
  } else {
    window.localStorage.setItem(key(matchId), JSON.stringify(existing));
  }
}

export function newWalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function sendWalEntry(matchId: string, entry: WalEntry) {
  const path =
    entry.kind === "record"
      ? `/api/matches/${matchId}/stats/record`
      : `/api/matches/${matchId}/stats/undo`;
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId: entry.playerId,
      action: entry.action,
      value: entry.value,
    }),
  });
  if (!res.ok) {
    throw new Error(`WAL send failed: ${res.status}`);
  }
}
