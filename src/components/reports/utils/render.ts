// Client-side rendering pipeline: HTML node → PNG blob → ZIP / PDF / share.

import { toPng } from "html-to-image";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";
import { REPORT_HEIGHT, REPORT_WIDTH } from "../cards/types";

const RENDER_OPTS = {
  width: REPORT_WIDTH,
  height: REPORT_HEIGHT,
  pixelRatio: 1,             // node is already at 1080×1350 so 1:1 is enough
  cacheBust: true,
  backgroundColor: "#0a0e17",
};

export async function nodeToPng(node: HTMLElement): Promise<Blob> {
  // toPng returns a data URL; convert it to a Blob for downloads + ZIPs.
  const dataUrl = await toPng(node, RENDER_OPTS);
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function nodeToDataUrl(node: HTMLElement): Promise<string> {
  return toPng(node, RENDER_OPTS);
}

export interface RenderedReport {
  playerId: string;
  playerName: string;
  blobs: { key: string; label: string; blob: Blob }[];
}

export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename);
}

export function safeFilename(s: string) {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_");
}

export async function downloadPlayerZip(
  report: RenderedReport,
  scopeLabel: string,
) {
  const zip = new JSZip();
  for (const b of report.blobs) {
    zip.file(
      `${safeFilename(report.playerName)}_${b.key}_${safeFilename(scopeLabel)}.png`,
      b.blob,
    );
  }
  const out = await zip.generateAsync({ type: "blob" });
  downloadBlob(
    out,
    `${safeFilename(report.playerName)}_ReportCard_${safeFilename(scopeLabel)}.zip`,
  );
}

export async function downloadTeamZip(
  reports: RenderedReport[],
  teamName: string,
  scopeLabel: string,
) {
  const zip = new JSZip();
  for (const r of reports) {
    const folder = zip.folder(safeFilename(r.playerName))!;
    for (const b of r.blobs) {
      folder.file(
        `${safeFilename(r.playerName)}_${b.key}_${safeFilename(scopeLabel)}.png`,
        b.blob,
      );
    }
  }
  const out = await zip.generateAsync({ type: "blob" });
  downloadBlob(
    out,
    `${safeFilename(teamName)}_${safeFilename(scopeLabel)}_Reports.zip`,
  );
}

export async function downloadPlayerPdf(
  report: RenderedReport,
  scopeLabel: string,
) {
  // Each image is 1080×1350. Use that as the page size in points so 1px == 1pt
  // and we don't lose detail to a fit-to-A4 transform.
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [REPORT_WIDTH, REPORT_HEIGHT],
  });
  for (let i = 0; i < report.blobs.length; i++) {
    const blob = report.blobs[i].blob;
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    if (i > 0) pdf.addPage([REPORT_WIDTH, REPORT_HEIGHT], "portrait");
    pdf.addImage(dataUrl, "PNG", 0, 0, REPORT_WIDTH, REPORT_HEIGHT);
  }
  pdf.save(
    `${safeFilename(report.playerName)}_Report_${safeFilename(scopeLabel)}.pdf`,
  );
}

export async function sharePlayer(
  report: RenderedReport,
  scopeLabel: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return { ok: false, reason: "web-share-unsupported" };
  }
  const files = report.blobs.map(
    (b) =>
      new File(
        [b.blob],
        `${safeFilename(report.playerName)}_${b.key}.png`,
        { type: "image/png" },
      ),
  );
  // navigator.canShare is the right pre-flight on mobile Safari/Chrome.
  if (
    typeof navigator.canShare === "function" &&
    !navigator.canShare({ files })
  ) {
    return { ok: false, reason: "files-not-shareable" };
  }
  try {
    await navigator.share({
      files,
      title: `${report.playerName} - match report`,
      text: `${report.playerName}'s performance from ${scopeLabel}`,
    });
    return { ok: true };
  } catch (err) {
    if ((err as Error).name === "AbortError") return { ok: true };
    return { ok: false, reason: "share-failed" };
  }
}
