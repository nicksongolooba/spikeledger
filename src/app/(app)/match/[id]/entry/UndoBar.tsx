"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { actionButtonLabel } from "./ActionPanel";
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
        "fixed inset-x-0 bottom-14 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:bottom-0",
      )}
    >
      {expanded && (
        <div className="max-h-64 overflow-y-auto border-b border-slate-200 px-3 py-2">
          {entries.length === 0 ? (
            <div className="py-2 text-center text-xs text-slate-500">
              Nothing to undo yet.
            </div>
          ) : (
            <ul className="space-y-1">
              {/* Undo goes strictly backwards: only the newest action can be
                  undone, because each undo restores the serve and rotation
                  as they were just before that action. */}
              {[...entries].reverse().map((e, i) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="truncate text-slate-600">
                    {actionButtonLabel(e.action)}
                    {e.playerName && (
                      <>
                        ,{" "}
                        <span className="font-semibold text-slate-900">{e.playerName}</span>
                      </>
                    )}
                  </span>
                  {i === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        onUndo(e.id);
                      }}
                      className="rounded border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Undo
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">undo newer first</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 lg:pl-[16.5rem]">
        <button
          type="button"
          onClick={() => last && onUndo(last.id)}
          disabled={!last}
          className="flex min-h-[44px] flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 enabled:hover:border-slate-400"
        >
          <Undo2 size={18} strokeWidth={2} className="shrink-0 text-slate-500" aria-hidden />
          {last ? (
            <span className="truncate" data-undo-last>
              <span className="text-slate-500">Undo:</span> {actionButtonLabel(last.action)}
              {last.playerName && (
                <>
                  ,{" "}
                  <span className="font-semibold text-slate-900">{last.playerName}</span>
                </>
              )}
            </span>
          ) : (
            <span className="text-slate-500">Nothing to undo</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-400"
          aria-label="Toggle undo history"
          aria-expanded={expanded}
        >
          <span className="stat-number text-base font-bold">{entries.length}</span>
          {expanded ? (
            <ChevronDown size={16} strokeWidth={2} className="text-slate-500" aria-hidden />
          ) : (
            <ChevronUp size={16} strokeWidth={2} className="text-slate-500" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
