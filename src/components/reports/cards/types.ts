import type { Position } from "@prisma/client";
import type { BankAccountResult } from "@/engine/bank-account";
import type { DerivedStats } from "@/engine/derived-stats";
import type { InsightProvider } from "@/engine/ai/types";
import type { ImprovementArea } from "../utils/improvement-rules";

export interface ReportCardData {
  player: {
    id: string;
    name: string;
    number: number | null;
    position: Position;          // position to evaluate against (most-played for dual-role)
    primaryPosition: Position;
    secondaryPosition: Position | null;
  };
  team: { id: string; name: string };
  scopeLabel: string;            // "16U Tournament 3" or "Full Season"
  stats: DerivedStats;
  bankAccount: BankAccountResult;
  improvementAreas: ImprovementArea[];
  // Set when the user has enabled AI insights for this generation run.
  aiSummary?: string;            // 1-2 sentence overview shown on Performance Overview
  aiParentFriendly?: string;     // plain-English summary saved with the share link
  aiProvider?: InsightProvider;
  // For team comparison - within-position-group cohort
  cohort: Array<{
    playerId: string;
    name: string;
    bankBalance: number;
    primaryStat: number;          // kills/match for hitters, SR avg for liberos, etc.
    primaryStatLabel: string;
    errorsPerMatch: number;
    secondaryStat: number;        // blocks/match for middles, aces/match for setters, etc.
    secondaryStatLabel: string;
  }>;
}

// Image dimensions - locked at 1080×1350 (4:5) so they look right in
// WhatsApp previews and on portrait phone screens.
export const REPORT_WIDTH = 1080;
export const REPORT_HEIGHT = 1350;

// Color + type tokens shared across cards. Keep as plain strings (not
// Tailwind classes) - html-to-image relies on computed CSS and these end up
// inline. They mirror the "Scoreboard" tokens in tailwind.config.ts: white
// cards, slate neutrals, navy primary, orange accent, emerald/red ledger.
export const REPORT_BG = "#ffffff";           // card surface
export const REPORT_CARD_BG = "#f4f6f9";      // inset panels (paper)
export const REPORT_BORDER = "#e2e8f0";       // slate-200 hairlines
export const REPORT_TEXT = "#0f172a";         // slate-900 headings + values
export const REPORT_BODY = "#475569";         // slate-600 body copy
export const REPORT_MUTED = "#64748b";        // slate-500 labels
export const REPORT_DIM = "#94a3b8";          // slate-400 decorative only

export const REPORT_NAVY = "#0b1a33";         // navy-900 primary
export const REPORT_NAVY_LIGHT = "#b9c8de";   // navy-200 secondary bars
export const REPORT_ORANGE = "#e4520b";       // orange-500 accent fills
export const REPORT_ORANGE_DEEP = "#a33808";  // orange-700 accent text on white
export const REPORT_ORANGE_LIGHT = "#ffa572"; // orange-300 accent text on navy
export const REPORT_ORANGE_TINT = "#fff4ec";  // orange-50 highlighted rows
export const REPORT_GREEN = "#059669";        // emerald-600 deposits
export const REPORT_RED = "#dc2626";          // red-600 withdrawals

// Barlow is loaded by next/font in app/layout.tsx and exposed as CSS
// variables on <html>, so the hidden capture tree inherits them.
export const REPORT_FONT =
  'var(--font-barlow), "Barlow", system-ui, sans-serif';
export const REPORT_FONT_DISPLAY =
  'var(--font-barlow-condensed), "Barlow Condensed", "Arial Narrow", sans-serif';
