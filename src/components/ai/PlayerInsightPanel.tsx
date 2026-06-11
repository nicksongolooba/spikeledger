"use client";

import { useCallback, useEffect, useState } from "react";
import { AIBadge, AIUnavailableNote } from "./AIBadge";
import { InsightSkeleton } from "./InsightSkeleton";
import { youtubeSearchUrl } from "@/lib/youtube";
import type { PlayerInsightResponse } from "@/engine/ai/types";

export function PlayerInsightPanel({
  playerId,
  scope,
  scopeId,
}: {
  playerId: string;
  scope: "match" | "tournament" | "season";
  scopeId?: string | null;
}) {
  const [data, setData] = useState<PlayerInsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (forceRefresh) headers["X-Refresh"] = "1";
      const res = await fetch("/api/ai/insight/player", {
        method: "POST",
        headers,
        body: JSON.stringify({ playerId, scope, scopeId: scopeId ?? null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not load insights.");
      }
      const json = (await res.json()) as PlayerInsightResponse;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    },
    [playerId, scope, scopeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <InsightSkeleton lines={5} />;
  if (error)
    return <div className="card p-4 text-sm text-red-300">{error}</div>;
  if (!data) return null;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4 text-gold-300"
          >
            <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
          </svg>
          Coach analysis
          <AIBadge provider={data.provider} cached={data.cached} />
        </h3>
        <button
          type="button"
          onClick={() => void load(true)}
          className="btn-ghost px-2 py-1 text-xs"
        >
          Refresh
        </button>
      </div>

      <p className="text-sm leading-relaxed text-slate-100">{data.summary}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Strengths
          </h4>
          <ul className="mt-1.5 space-y-1.5 text-sm text-slate-200">
            {data.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Focus areas
          </h4>
          <ul className="mt-1.5 space-y-2 text-sm text-slate-200">
            {data.improvements.map((imp, i) => {
              const specs = [imp.duration, imp.reps, imp.players, imp.equipment]
                .map((s) => s?.trim())
                .filter((s): s is string => Boolean(s));
              const ytUrl = imp.youtubeQuery
                ? youtubeSearchUrl(imp.youtubeQuery)
                : "";
              return (
                <li key={i}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-slate-100">{imp.area}</span>
                    <span className="font-mono text-xs text-slate-500">
                      {imp.currentValue} → {imp.targetValue}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">{imp.drill}</div>
                  {specs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-slate-500">
                      {specs.map((s, j) => (
                        <span key={j}>{s}</span>
                      ))}
                    </div>
                  )}
                  {ytUrl && (
                    <a
                      href={ytUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gold-300 hover:text-gold-200 hover:underline"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path d="M10 16.5l6-4.5-6-4.5v9zM12 2a10 10 0 100 20 10 10 0 000-20z" />
                      </svg>
                      Watch drill videos
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-5 grid gap-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:grid-cols-2">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-volt-300">
            Tactical note
          </h4>
          <p className="mt-1 text-xs text-slate-300">{data.coachingNote}</p>
        </div>
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            For parents
          </h4>
          <p
            className="mt-1 text-xs text-slate-300"
            dangerouslySetInnerHTML={{ __html: data.parentFriendly }}
          />
        </div>
      </div>

      {data.provider === "rule-based" && (
        <AIUnavailableNote className="mt-3" />
      )}
    </div>
  );
}
