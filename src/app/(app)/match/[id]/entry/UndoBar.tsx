"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { STAT_ACTION_LABELS } from "@/lib/stat-actions";
import type { UndoEntry } from "./types";

export function UndoBar({
  entries,
  onUndo,
}: {
  entries: UndoEntry[];
  onUndo: (entryId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const last = entries[entries.length - 1] ?? null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-14 z-30 border-t border-slate-800 bg-slate-900/95 backdrop-blur lg:bottom-0",
      )}
    >
      {expanded && (
        <div className="max-h-64 overflow-y-auto border-b border-slate-800 px-3 py-2">
          {entries.length === 0 ? (
            <div className="py-2 text-center text-xs text-slate-500">
              Nothing to undo yet.
            </div>
          ) : (
            <ul className="space-y-1">
              {[...entries].reverse().map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-slate-800/60"
                >
                  <span className="truncate text-slate-300">
                    <span className="font-medium text-slate-100">
                      {e.playerName}
                    </span>{" "}
                    +1 {STAT_ACTION_LABELS[e.action]}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onUndo(e.id);
                    }}
                    className="rounded-md border border-red-400/30 px-2 py-0.5 text-xs text-red-300 hover:bg-red-400/10"
                  >
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => last && onUndo(last.id)}
          disabled={!last}
          className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 enabled:hover:border-slate-600"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 text-slate-400"
          >
            <path d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 010 14H6a1 1 0 110-2h5a5 5 0 100-10H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
          </svg>
          {last ? (
            <span className="truncate">
              <span className="text-slate-500">Undo:</span>{" "}
              <span className="font-medium text-slate-100">
                {last.playerName}
              </span>{" "}
              +1 {STAT_ACTION_LABELS[last.action]}
            </span>
          ) : (
            <span className="text-slate-500">Nothing to undo</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="relative rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:border-slate-600"
          aria-label="Toggle undo history"
        >
          <span className="stat-number text-sm font-bold">{entries.length}</span>
          <span className="ml-1 text-xs text-slate-500">
            {expanded ? "▾" : "▴"}
          </span>
        </button>
      </div>
    </div>
  );
}
