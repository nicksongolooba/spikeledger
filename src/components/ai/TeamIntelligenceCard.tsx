"use client";

import { useCallback, useEffect, useState } from "react";
import { AIBadge, AIUnavailableNote } from "./AIBadge";
import { InsightSkeleton } from "./InsightSkeleton";
import type { TeamInsightResponse } from "@/engine/ai/types";

export function TeamIntelligenceCard({
  teamId,
  scope,
  scopeId,
  title = "AI Coach Analysis",
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
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5 text-gold-300"
          >
            <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
          </svg>
          {title}
          {data && <AIBadge provider={data.provider} cached={data.cached} />}
        </h2>
        {data && !loading && (
          <button
            type="button"
            onClick={() => void load(true)}
            className="btn-ghost px-2 py-1 text-xs"
          >
            Refresh
          </button>
        )}
      </div>

      {loading ? (
        <InsightSkeleton lines={4} />
      ) : error ? (
        <div className="card p-4 text-sm text-red-300">{error}</div>
      ) : data ? (
        <div className="card p-5">
          <ul className="space-y-3">
            {data.insights.map((line, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-200">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-300" />
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
