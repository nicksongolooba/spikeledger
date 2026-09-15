"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CirclePlay, Lightbulb, RefreshCw } from "lucide-react";
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
    return <div className="card p-4 text-sm text-red-700">{error}</div>;
  if (!data) return null;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-xl font-bold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-50 text-navy-700">
            <Lightbulb size={18} strokeWidth={2} aria-hidden />
          </span>
          Coach analysis
          <AIBadge provider={data.provider} cached={data.cached} />
        </h3>
        <button
          type="button"
          onClick={() => void load(true)}
          className="btn-secondary px-2.5 py-1 text-xs"
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden />
          Refresh
        </button>
      </div>

      <p className="text-sm leading-relaxed text-slate-900">{data.summary}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-green-700">
            Strengths
          </h4>
          <ul className="mt-1.5 space-y-1.5 text-sm text-slate-800">
            {data.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
            Focus areas
          </h4>
          <ul className="mt-1.5 space-y-2 text-sm text-slate-800">
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
                    <span className="font-semibold text-slate-900">{imp.area}</span>
                    {(imp.currentValue !== "-" || imp.targetValue !== "-") && (
                      <span className="stat-number inline-flex items-center gap-1 text-sm font-bold text-slate-500">
                        {imp.currentValue}
                        <ArrowRight size={12} strokeWidth={2.5} aria-hidden />
                        <span className="text-slate-900">{imp.targetValue}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">{imp.drill}</div>
                  {specs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
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
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline"
                    >
                      <CirclePlay size={14} strokeWidth={2} aria-hidden />
                      Watch drill videos
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-5 grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        <div>
          <h4 className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-700">
            Tactical note
          </h4>
          <p className="mt-1 text-xs text-slate-700">{data.coachingNote}</p>
        </div>
        <div>
          <h4 className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            For parents
          </h4>
          <p className="mt-1 text-xs text-slate-700">{data.parentFriendly}</p>
        </div>
      </div>

      {data.provider === "rule-based" && (
        <AIUnavailableNote className="mt-3" />
      )}
    </div>
  );
}
