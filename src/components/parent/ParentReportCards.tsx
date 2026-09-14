"use client";

import { useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import {
  REPORT_CARDS,
  ReportCardByKey,
  type ReportCardKey,
} from "@/components/reports/ReportCardSet";
import {
  REPORT_HEIGHT,
  REPORT_WIDTH,
  type ReportCardData,
} from "@/components/reports/cards/types";
import {
  downloadPlayerPdf,
  downloadPlayerZip,
  nodeToPng,
  type RenderedReport,
} from "@/components/reports/utils/render";

// Parents never get the team-comparison card - it names teammates.
const PARENT_CARD_KEYS: ReportCardKey[] = ["overview", "numbers", "work-on", "bank", "breakdown"];

const PREVIEW_WIDTH = 216;

export function ParentReportCards({ data }: { data: ReportCardData }) {
  const cards = REPORT_CARDS.filter((c) => PARENT_CARD_KEYS.includes(c.key));
  const [busy, setBusy] = useState<"zip" | "pdf" | null>(null);
  const [renderingKey, setRenderingKey] = useState<ReportCardKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renderRootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<ReportCardKey | null>(null);

  // Mount each card at full size off-screen, screenshot it, collect blobs.
  async function renderAll(): Promise<RenderedReport> {
    const blobs: RenderedReport["blobs"] = [];
    for (const card of cards) {
      setRenderingKey(card.key);
      // Give React a frame to mount the card before capturing it.
      await new Promise((r) => setTimeout(r, 120));
      const root = renderRootRef.current;
      if (!root?.firstElementChild) throw new Error("Card did not mount");
      const blob = await nodeToPng(root.firstElementChild as HTMLElement);
      blobs.push({ key: card.key, label: card.label, blob });
    }
    setRenderingKey(null);
    return { playerId: data.player.id, playerName: data.player.name, blobs };
  }

  async function download(kind: "zip" | "pdf") {
    setBusy(kind);
    setError(null);
    try {
      const report = await renderAll();
      if (kind === "zip") await downloadPlayerZip(report, data.scopeLabel);
      else await downloadPlayerPdf(report, data.scopeLabel);
    } catch {
      setError("Could not build the images - try again in a moment.");
      setRenderingKey(null);
    } finally {
      setBusy(null);
    }
  }

  const scale = PREVIEW_WIDTH / REPORT_WIDTH;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Report cards
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {cards.length} images, sized for a phone. Tap one to see it bigger, or download the set.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => download("zip")} disabled={busy !== null} className="btn-navy">
            <Download size={16} strokeWidth={2} aria-hidden />
            {busy === "zip" ? "Building…" : "Download images"}
          </button>
          <button type="button" onClick={() => download("pdf")} disabled={busy !== null} className="btn-secondary">
            <FileText size={16} strokeWidth={2} aria-hidden />
            {busy === "pdf" ? "Building…" : "PDF"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setOpen(card.key)}
            className="shrink-0 text-left"
            aria-label={`Open ${card.label}`}
          >
            <div
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-lift"
              style={{ width: PREVIEW_WIDTH, height: Math.round(REPORT_HEIGHT * scale) }}
            >
              <div
                style={{
                  width: REPORT_WIDTH,
                  height: REPORT_HEIGHT,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <ReportCardByKey data={data} cardKey={card.key} />
              </div>
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{card.label}</div>
            <div className="text-xs text-slate-500">{card.caption}</div>
          </button>
        ))}
      </div>

      {/* Enlarged preview */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Report card preview"
        >
          <PreviewScaled data={data} cardKey={open} />
        </div>
      )}

      {/* Off-screen render target at full 1080x1350 for downloads. */}
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
        {renderingKey && <ReportCardByKey data={data} cardKey={renderingKey} />}
      </div>
    </section>
  );
}

function PreviewScaled({ data, cardKey }: { data: ReportCardData; cardKey: ReportCardKey }) {
  // Fit inside the viewport: 1080x1350 scaled to ~min(90vw, 80vh).
  const width = Math.min(typeof window !== "undefined" ? window.innerWidth * 0.9 : 600, 640);
  const scale = width / REPORT_WIDTH;
  return (
    <div
      className="overflow-hidden rounded-lg shadow-pop"
      style={{ width, height: Math.round(REPORT_HEIGHT * scale) }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ width: REPORT_WIDTH, height: REPORT_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <ReportCardByKey data={data} cardKey={cardKey} />
      </div>
    </div>
  );
}
