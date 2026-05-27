import type { Position } from "@prisma/client";
import type { BankAccountResult } from "@/engine/bank-account";
import type { DerivedStats } from "@/engine/derived-stats";
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
  aiProvider?: "ollama" | "google" | "rule-based";
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

// Background tokens shared across cards. Keep as plain strings (not Tailwind
// classes) - html-to-image relies on computed CSS and these end up inline.
export const REPORT_BG = "#0a0e17";
export const REPORT_CARD_BG = "#111827";
export const REPORT_BORDER = "#1f2937";
export const REPORT_TEXT = "#f1f5f9";
export const REPORT_MUTED = "#94a3b8";
export const REPORT_DIM = "#64748b";
