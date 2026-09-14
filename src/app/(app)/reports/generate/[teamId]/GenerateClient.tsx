"use client";

import { useMemo, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import type { Position } from "@prisma/client";
import { PositionBadge } from "@/components/ui/PositionBadge";
import {
  ReportCardByKey,
  REPORT_CARDS,
  type ReportCardKey,
} from "@/components/reports/ReportCardSet";
import {
  downloadBlob,
  downloadPlayerPdf,
  downloadPlayerZip,
  downloadTeamZip,
  nodeToPng,
  safeFilename,
  sharePlayer,
  type RenderedReport,
} from "@/components/reports/utils/render";
import {
  REPORT_HEIGHT,
  REPORT_WIDTH,
  type ReportCardData,
} from "@/components/reports/cards/types";
import type { PlayerInsightResponse } from "@/engine/ai/types";

interface PlayerLite {
  id: string;
  name: string;
  number: number | null;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  isActive: boolean;
}

interface ScopeOption {
  key: string;
  label: string;
  tournamentId: string | null;
}

interface Props {
  teamName: string;
  usesPositions?: boolean;
  scopeOptions: ScopeOption[];
  players: PlayerLite[];
  dataByPlayerByScope: Record<string, Record<string, ReportCardData>>;
  defaultScopeKey: string;
  preselectedPlayerId?: string;
}

export function GenerateClient({
  teamName,
  usesPositions = true,
  scopeOptions,
  players,
  dataByPlayerByScope,
  defaultScopeKey,
  preselectedPlayerId,
}: Props) {
  const [scopeKey, setScopeKey] = useState<string>(
    scopeOptions.find((s) => s.key === defaultScopeKey) ? defaultScopeKey : "season",
  );
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    new Set(preselectedPlayerId ? [preselectedPlayerId] : []),
  );
  const [enabledCards, setEnabledCards] = useState<Set<ReportCardKey>>(
    new Set(REPORT_CARDS.filter((c) => c.key !== "comparison").map((c) => c.key)),
  );
  const [includeComparison, setIncludeComparison] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({
    done: 0,
    total: 0,
    stage: "idle" as "idle" | "ai" | "render",
  });
  const [rendered, setRendered] = useState<
    Array<RenderedReport & { aiParentFriendly?: string; aiProvider?: string }>
  >([]);

  // Auto-include comparison toggle in the report set
  const finalCards = useMemo(() => {
    const set = new Set(enabledCards);
    if (includeComparison) set.add("comparison");
    else set.delete("comparison");
    return REPORT_CARDS.filter((c) => set.has(c.key));
  }, [enabledCards, includeComparison]);

  const scopeData = dataByPlayerByScope[scopeKey] ?? {};
  const playersWithData = players.filter((p) => scopeData[p.id]);
  const previewPlayer =
    [...selectedPlayers].find((id) => scopeData[id]) ??
    playersWithData[0]?.id ??
    null;
  const previewData = previewPlayer ? scopeData[previewPlayer] : null;

  // Hidden render target - sized to the exact PNG dimensions so html-to-image
  // captures a 1:1 pixel snapshot.
  const renderRootRef = useRef<HTMLDivElement>(null);
  const [renderingNow, setRenderingNow] = useState<{
    data: ReportCardData;
    cardKey: ReportCardKey;
  } | null>(null);

  function togglePlayer(id: string) {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllPlayers() {
    setSelectedPlayers(new Set(playersWithData.map((p) => p.id)));
  }
  function clearPlayers() {
    setSelectedPlayers(new Set());
  }

  function toggleCard(k: ReportCardKey) {
    setEnabledCards((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function fetchInsight(
    playerId: string,
    scopeOption: ScopeOption,
  ): Promise<PlayerInsightResponse | null> {
    try {
      const res = await fetch("/api/ai/insight/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          scope: scopeOption.tournamentId ? "tournament" : "season",
          scopeId: scopeOption.tournamentId,
        }),
      });
      if (!res.ok) return null;
      return (await res.json()) as PlayerInsightResponse;
    } catch {
      return null;
    }
  }

  async function generate() {
    setRendered([]);
    const playerIds = [...selectedPlayers].filter((id) => scopeData[id]);
    if (playerIds.length === 0 || finalCards.length === 0) return;
    const scopeOption = scopeOptions.find((s) => s.key === scopeKey)!;
    setBusy(true);
    setProgress({
      done: 0,
      total: playerIds.length * finalCards.length + (useAI ? playerIds.length : 0),
      stage: useAI ? "ai" : "render",
    });

    const out: Array<RenderedReport & { aiParentFriendly?: string; aiProvider?: string }> = [];
    for (const pid of playerIds) {
      let data = scopeData[pid];
      let aiParentFriendly: string | undefined;
      let aiProvider: string | undefined;

      if (useAI) {
        setProgress((p) => ({ ...p, stage: "ai" }));
        const insight = await fetchInsight(pid, scopeOption);
        if (insight) {
          aiParentFriendly = insight.parentFriendly;
          aiProvider = insight.provider;
          data = {
            ...data,
            aiSummary: insight.summary,
            aiParentFriendly: insight.parentFriendly,
            aiProvider: insight.provider,
            improvementAreas: insight.improvements.slice(0, 3).map((imp) => ({
              metric: imp.area,
              current: imp.currentValue,
              target: imp.targetValue,
              detail: imp.drill,
              severity: 0.5,
            })),
          };
        }
        setProgress((p) => ({ ...p, done: p.done + 1, stage: "render" }));
      }

      const blobs: RenderedReport["blobs"] = [];
      for (const card of finalCards) {
        setRenderingNow({ data, cardKey: card.key });
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await new Promise((r) => setTimeout(r, 60));
        const root = renderRootRef.current;
        if (!root) continue;
        const blob = await nodeToPng(root.firstElementChild as HTMLElement);
        blobs.push({ key: card.key, label: card.label, blob });
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      out.push({
        playerId: pid,
        playerName: data.player.name,
        blobs,
        aiParentFriendly,
        aiProvider,
      });
    }
    setRenderingNow(null);
    setRendered(out);
    setBusy(false);
    setProgress((p) => ({ ...p, stage: "idle" }));
  }

  const scopeLabel = scopeOptions.find((s) => s.key === scopeKey)?.label ?? "Season";

  return (
    <div className="space-y-6">
      {/* Step 1: Scope */}
      <div className="card p-5">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
          1. Choose scope
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {scopeOptions.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScopeKey(s.key)}
              className={
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors " +
                (scopeKey === s.key
                  ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-300")
              }
            >
              {s.label}
              <span className="ml-2 text-xs text-slate-500">
                {Object.keys(dataByPlayerByScope[s.key] ?? {}).length} players
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Players */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
            2. Choose players
          </h2>
          <div className="flex gap-2">
            <button onClick={selectAllPlayers} className="btn-ghost px-2 py-1 text-xs">
              Select all
            </button>
            <button onClick={clearPlayers} className="btn-ghost px-2 py-1 text-xs">
              Clear
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {players.map((p) => {
            const hasData = !!scopeData[p.id];
            const selected = selectedPlayers.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => hasData && togglePlayer(p.id)}
                disabled={!hasData}
                className={
                  "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors " +
                  (selected
                    ? "border-cyan-500 bg-cyan-50"
                    : hasData
                      ? "border-slate-200 bg-white hover:border-slate-300"
                      : "cursor-not-allowed border-slate-200 bg-white/40 opacity-50")
                }
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 stat-number text-sm font-bold">
                  {p.number ?? "-"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {p.name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <PositionBadge position={p.primaryPosition} size="xs" neutral={!usesPositions} />
                    {usesPositions && p.secondaryPosition && (
                      <PositionBadge position={p.secondaryPosition} size="xs" />
                    )}
                    {!hasData && (
                      <span className="text-[10px] text-slate-500">no stats yet</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3: Reports */}
      <div className="card p-5">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
          3. Choose reports
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {REPORT_CARDS.filter((c) => c.key !== "comparison").map((c) => (
            <label
              key={c.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <input
                type="checkbox"
                checked={enabledCards.has(c.key)}
                onChange={() => toggleCard(c.key)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="text-sm font-medium text-slate-900">
                  {c.label}
                </span>
                <span className="block text-xs text-slate-500">{c.caption}</span>
              </span>
            </label>
          ))}
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <input
            type="checkbox"
            checked={includeComparison}
            onChange={(e) => setIncludeComparison(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="text-sm font-medium text-amber-800">
              Include team comparison (image 6)
            </span>
            <span className="mt-0.5 block text-xs text-amber-800">
              Shows how each player ranks against teammates in the same
              position group. Some coaches share this only privately - opt-in.
            </span>
          </span>
        </label>

        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-md border border-navy-200 bg-navy-50 p-3">
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) => setUseAI(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <Lightbulb size={16} strokeWidth={2} className="text-navy-700" aria-hidden />
              Add AI coaching notes
            </span>
            <span className="mt-0.5 block text-xs text-navy-700">
              Adds an AI-generated coaching summary on the Performance Overview
              and replaces &quot;What To Work On&quot; with data-grounded drills.
              Falls back silently if AI is unavailable. ~5-30s per player.
            </span>
          </span>
        </label>
      </div>

      {/* Step 4: Preview & generate */}
      <div className="card p-5">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
          4. Preview & generate
        </h2>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <div className="text-sm text-slate-700">
              Scope: <span className="text-cyan-700">{scopeLabel}</span>
            </div>
            <div className="text-sm text-slate-700">
              {selectedPlayers.size} player(s) · {finalCards.length} image(s) each
              ={" "}
              <span className="font-bold text-slate-900">
                {selectedPlayers.size * finalCards.length}
              </span>{" "}
              images
            </div>
            <button
              type="button"
              disabled={
                busy ||
                selectedPlayers.size === 0 ||
                finalCards.length === 0
              }
              onClick={generate}
              className="btn-primary mt-3"
            >
              {busy
                ? progress.stage === "ai"
                  ? `Calling AI… ${progress.done}/${progress.total}`
                  : `Rendering ${progress.done}/${progress.total}…`
                : "Generate"}
            </button>
            {busy && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-cyan-500 transition-all"
                  style={{
                    width:
                      progress.total > 0
                        ? `${(progress.done / progress.total) * 100}%`
                        : 0,
                  }}
                />
              </div>
            )}
          </div>

          {previewData && (
            <div className="lg:max-w-[200px]">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">
                Preview · {previewData.player.name}
              </div>
              <div
                className="overflow-hidden rounded-lg border border-slate-200"
                style={{ width: 200 }}
              >
                <div
                  style={{
                    width: REPORT_WIDTH,
                    height: REPORT_HEIGHT,
                    transform: `scale(${200 / REPORT_WIDTH})`,
                    transformOrigin: "top left",
                  }}
                >
                  <ReportCardByKey data={previewData} cardKey="overview" />
                </div>
                <div
                  style={{
                    height: REPORT_HEIGHT * (200 / REPORT_WIDTH),
                    marginTop: -REPORT_HEIGHT,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rendered output */}
      {rendered.length > 0 && (
        <div className="card p-5">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
            5. Download
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => downloadTeamZip(rendered, teamName, scopeLabel)}
              className="btn-primary"
            >
              Team ZIP ({rendered.length} players)
            </button>
          </div>
          <div className="mt-5 space-y-4">
            {rendered.map((r) => (
              <div
                key={r.playerId}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900">
                    {r.playerName}
                    <span className="ml-2 text-xs text-slate-500">
                      {r.blobs.length} image{r.blobs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => downloadPlayerZip(r, scopeLabel)}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      ZIP
                    </button>
                    <button
                      onClick={() => downloadPlayerPdf(r, scopeLabel)}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      PDF
                    </button>
                    <button
                      onClick={async () => {
                        const result = await sharePlayer(r, scopeLabel);
                        if (!result.ok && result.reason !== "files-not-shareable") {
                          alert("Web Share isn't supported here - use the ZIP / PDF buttons.");
                        }
                      }}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      Share…
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {r.blobs.map((b) => {
                    const url = URL.createObjectURL(b.blob);
                    return (
                      <a
                        key={b.key}
                        href={url}
                        download={`${safeFilename(r.playerName)}_${b.key}.png`}
                        onClick={() => {
                          // Revoke after the click - browsers usually finish the download first.
                          setTimeout(() => URL.revokeObjectURL(url), 5000);
                        }}
                        className="group relative overflow-hidden rounded-md border border-slate-200 transition-colors hover:border-cyan-300"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={b.label}
                          className="block w-full"
                          style={{ aspectRatio: `${REPORT_WIDTH} / ${REPORT_HEIGHT}` }}
                        />
                        <div className="absolute inset-x-0 bottom-0 truncate bg-navy-950/80 px-2 py-1 text-center text-[10px] text-slate-700">
                          {b.label}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Off-screen render target. Card is mounted at full 1080×1350 inside
          a positioned wrapper so it doesn't disrupt page layout. */}
      <div
        ref={renderRootRef}
        style={{
          position: "fixed",
          left: "-100000px",
          top: 0,
          width: `${REPORT_WIDTH}px`,
          height: `${REPORT_HEIGHT}px`,
          pointerEvents: "none",
        }}
      >
        {renderingNow && (
          <ReportCardByKey
            data={renderingNow.data}
            cardKey={renderingNow.cardKey}
          />
        )}
      </div>

      {/* Share-link CTA (saves a copy to the server) */}
      {rendered.length > 0 && (
        <ShareLink
          teamName={teamName}
          scopeKey={scopeKey}
          scopeLabel={scopeLabel}
          rendered={rendered}
        />
      )}
    </div>
  );
}

function ShareLink({
  scopeLabel,
  rendered,
  scopeKey: _scopeKey,
  teamName: _teamName,
}: {
  teamName: string;
  scopeKey: string;
  scopeLabel: string;
  rendered: Array<RenderedReport & { aiParentFriendly?: string; aiProvider?: string }>;
}) {
  const [linksByPlayer, setLinksByPlayer] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  }

  async function createShareLink(
    r: RenderedReport & { aiParentFriendly?: string; aiProvider?: string },
  ) {
    setBusy(r.playerId);
    setError(null);
    try {
      const images = await Promise.all(
        r.blobs.map(async (b) => ({
          key: b.key,
          label: b.label,
          dataUrl: await blobToDataUrl(b.blob),
        })),
      );
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: r.playerId,
          playerName: r.playerName,
          scopeLabel,
          images,
          parentFriendly: r.aiParentFriendly,
          aiProvider: r.aiProvider,
        }),
      });
      if (!res.ok) throw new Error("Server rejected the share request.");
      const json = await res.json();
      const url = `${window.location.origin}/share/${json.id}`;
      setLinksByPlayer((prev) => ({ ...prev, [r.playerId]: url }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
        6. Share link (no login needed to view)
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Generates a public read-only URL per player you can text to parents.
      </p>
      {error && (
        <div className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mt-3 space-y-2">
        {rendered.map((r) => {
          const link = linksByPlayer[r.playerId];
          return (
            <div
              key={r.playerId}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-900">{r.playerName}</span>
              {link ? (
                <>
                  <input
                    readOnly
                    value={link}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="input flex-1 min-w-0 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(link)}
                    className="btn-ghost px-2 py-1 text-xs"
                  >
                    Copy
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy === r.playerId}
                  onClick={() => createShareLink(r)}
                  className="btn-ghost ml-auto px-2 py-1 text-xs"
                >
                  {busy === r.playerId ? "Creating…" : "Create share link"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
