"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbulb, RefreshCw } from "lucide-react";
import { AIBadge, AIUnavailableNote } from "./AIBadge";
import { InsightSkeleton } from "./InsightSkeleton";
import type { TeamInsightResponse } from "@/engine/ai/types";

export function TeamIntelligenceCard({
  teamId,
  scope,
  scopeId,
  title = "Coach analysis",
}: {
  teamId: string;
  scope: "tournament" | "season";
  scopeId?: string | null;
  title?: string;
}) {
  const [data, setData] = useState<TeamInsightResponse | null>(null);
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
        const res = await fetch("/api/ai/insight/team", {
          method: "POST",
          headers,
          body: JSON.stringify({ teamId, scope, scopeId: scopeId ?? null }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Could not load AI analysis.");
        }
        const json = (await res.json()) as TeamInsightResponse;
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [teamId, scope, scopeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-50 text-navy-700">
            <Lightbulb size={18} strokeWidth={2} aria-hidden />
          </span>
          {title}
          {data && <AIBadge provider={data.provider} cached={data.cached} />}
        </h2>
        {data && !loading && (
          <button
            type="button"
            onClick={() => void load(true)}
            className="btn-secondary px-2.5 py-1 text-xs"
          >
            <RefreshCw size={14} strokeWidth={2} aria-hidden />
            Refresh
          </button>
        )}
      </div>

      {loading ? (
        <InsightSkeleton lines={4} />
      ) : error ? (
        <div className="card p-4 text-sm text-red-700">{error}</div>
      ) : data ? (
        <div className="card p-5">
          <ul className="space-y-3">
            {data.insights.map((line, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-800">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
          {data.provider === "rule-based" && (
            <AIUnavailableNote className="mt-4" />
          )}
        </div>
      ) : null}
    </section>
  );
}
