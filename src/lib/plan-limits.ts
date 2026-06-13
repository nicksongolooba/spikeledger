// Plan-tier capabilities - single source of truth used by both server
// gating (API routes) and client UI (badges, upgrade prompts).

import type { Plan } from "@prisma/client";

export type FeatureKey =
  | "aiInsights"
  | "coachChat"
  | "shareLinks"
  | "pdfExport"
  | "csvImport"
  | "seasonReports"
  | "teamComparisonReport";

export interface PlanLimits {
  maxTeams: number;                       // Number.POSITIVE_INFINITY for unlimited
  maxTournamentsPerTeam: number;
  maxReportCardsPerTournament: number;    // # of players whose cards can be generated
  maxCoaches: number;                     // for club tier
  chatMessagesPerDay: number;             // "Ask Coach AI" daily cap
  features: Record<FeatureKey, boolean>;
}

const FREE: PlanLimits = {
  maxTeams: 1,
  maxTournamentsPerTeam: 3,
  maxReportCardsPerTournament: 1,
  maxCoaches: 1,
  chatMessagesPerDay: 0,
  features: {
    aiInsights: false,
    coachChat: false,
    shareLinks: false,
    pdfExport: false,
    csvImport: false,
    seasonReports: false,
    teamComparisonReport: false,
  },
};

const PRO: PlanLimits = {
  maxTeams: Number.POSITIVE_INFINITY,
  maxTournamentsPerTeam: Number.POSITIVE_INFINITY,
  maxReportCardsPerTournament: Number.POSITIVE_INFINITY,
  maxCoaches: 1,
  chatMessagesPerDay: 50,
  features: {
    aiInsights: true,
    coachChat: true,
    shareLinks: true,
    pdfExport: true,
    csvImport: true,
    seasonReports: true,
    teamComparisonReport: true,
  },
};

const CLUB: PlanLimits = {
  ...PRO,
  maxCoaches: 15,
  chatMessagesPerDay: 200,
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE,
  COACH_PRO: PRO,
  CLUB,
};

export const PLAN_LABEL: Record<Plan, string> = {
  FREE: "Free",
  COACH_PRO: "Coach Pro",
  CLUB: "Club",
};

export interface PlanPrice {
  monthlyCents: number;     // CAD cents
  yearlyCents: number;
  monthlyPriceId?: string;
  yearlyPriceId?: string;
}

export const PLAN_PRICING: Record<Exclude<Plan, "FREE">, PlanPrice> = {
  COACH_PRO: {
    monthlyCents: 999,
    yearlyCents: 9999,
    monthlyPriceId: process.env.STRIPE_COACH_PRO_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.STRIPE_COACH_PRO_YEARLY_PRICE_ID,
  },
  CLUB: {
    monthlyCents: 4999,
    yearlyCents: 49999,
    monthlyPriceId: process.env.STRIPE_CLUB_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.STRIPE_CLUB_YEARLY_PRICE_ID,
  },
};

export function fmtCAD(cents: number): string {
  return `$${(cents / 100).toFixed(2)} CAD`;
}

export function isUnlimited(n: number) {
  return !Number.isFinite(n);
}

export function hasFeature(plan: Plan, feature: FeatureKey): boolean {
  return PLAN_LIMITS[plan].features[feature];
}

export interface UpgradeReason {
  feature: string;
  reason: string;
  recommendedPlan: Exclude<Plan, "FREE">;
}

// Returns a short, user-friendly reason for why an action is blocked, plus the
// plan they need to do it. Used by the UpgradePrompt component.
export function getUpgradeReason(
  plan: Plan,
  action:
    | "add-team"
    | "add-tournament"
    | "generate-report-card"
    | "ai-insights"
    | "coach-chat"
    | "share-link"
    | "pdf-export"
    | "csv-import"
    | "season-report"
    | "team-comparison",
): UpgradeReason {
  switch (action) {
    case "add-team":
      return {
        feature: "Multiple teams",
        reason:
          plan === "FREE"
            ? "Free coaches can manage one team. Upgrade to Coach Pro for unlimited teams."
            : "Upgrade to Club to manage multiple teams shared with assistant coaches.",
        recommendedPlan: plan === "FREE" ? "COACH_PRO" : "CLUB",
      };
    case "add-tournament":
      return {
        feature: "More tournaments",
        reason:
          "Free plan caps out at 3 tournaments per team. Coach Pro is unlimited.",
        recommendedPlan: "COACH_PRO",
      };
    case "generate-report-card":
      return {
        feature: "Bulk report cards",
        reason:
          "Free plan generates one report card per tournament so you can see the quality. Coach Pro generates them for every player.",
        recommendedPlan: "COACH_PRO",
      };
    case "ai-insights":
      return {
        feature: "AI coaching insights",
        reason:
          "AI insights with specific drill recommendations. Coach Pro and up.",
        recommendedPlan: "COACH_PRO",
      };
    case "coach-chat":
      return {
        feature: "Ask Coach AI",
        reason:
          "Chat with an AI assistant that knows your team's stats - lineups, matchups, practice plans. Coach Pro and up.",
        recommendedPlan: "COACH_PRO",
      };
    case "share-link":
      return {
        feature: "Parent share links",
        reason:
          "Generate public read-only links you can text to parents. Coach Pro and up.",
        recommendedPlan: "COACH_PRO",
      };
    case "pdf-export":
      return {
        feature: "PDF export",
        reason:
          "All six report card images compiled into a single PDF. Coach Pro and up.",
        recommendedPlan: "COACH_PRO",
      };
    case "csv-import":
      return {
        feature: "CSV / Excel import",
        reason:
          "Backfill historical seasons from a spreadsheet. Coach Pro and up.",
        recommendedPlan: "COACH_PRO",
      };
    case "season-report":
      return {
        feature: "Season-wide reports",
        reason:
          "Roll up every tournament into a single season Bank Account report. Coach Pro and up.",
        recommendedPlan: "COACH_PRO",
      };
    case "team-comparison":
      return {
        feature: "Team comparison report",
        reason:
          "Rank players against teammates in the same position group. Coach Pro and up.",
        recommendedPlan: "COACH_PRO",
      };
  }
}

export interface UsageSnapshot {
  teams: number;
  tournamentsByTeam: Record<string, number>;
  reportsThisMonth: number;
}

export interface ActionContext {
  teamId?: string;
  currentTeamCount?: number;
  currentTournamentCount?: number;
  currentReportsThisTournament?: number;
}

export function canUserPerformAction(
  plan: Plan,
  action:
    | "add-team"
    | "add-tournament"
    | "generate-report-card"
    | "ai-insights"
    | "coach-chat"
    | "share-link"
    | "pdf-export"
    | "csv-import"
    | "season-report"
    | "team-comparison",
  context: ActionContext = {},
): { allowed: boolean; reason?: UpgradeReason } {
  const limits = PLAN_LIMITS[plan];
  switch (action) {
    case "add-team": {
      const used = context.currentTeamCount ?? 0;
      if (used < limits.maxTeams) return { allowed: true };
      return { allowed: false, reason: getUpgradeReason(plan, action) };
    }
    case "add-tournament": {
      const used = context.currentTournamentCount ?? 0;
      if (used < limits.maxTournamentsPerTeam) return { allowed: true };
      return { allowed: false, reason: getUpgradeReason(plan, action) };
    }
    case "generate-report-card": {
      const used = context.currentReportsThisTournament ?? 0;
      if (used < limits.maxReportCardsPerTournament) return { allowed: true };
      return { allowed: false, reason: getUpgradeReason(plan, action) };
    }
    case "ai-insights":
      return limits.features.aiInsights
        ? { allowed: true }
        : { allowed: false, reason: getUpgradeReason(plan, action) };
    case "coach-chat":
      return limits.features.coachChat
        ? { allowed: true }
        : { allowed: false, reason: getUpgradeReason(plan, action) };
    case "share-link":
      return limits.features.shareLinks
        ? { allowed: true }
        : { allowed: false, reason: getUpgradeReason(plan, action) };
    case "pdf-export":
      return limits.features.pdfExport
        ? { allowed: true }
        : { allowed: false, reason: getUpgradeReason(plan, action) };
    case "csv-import":
      return limits.features.csvImport
        ? { allowed: true }
        : { allowed: false, reason: getUpgradeReason(plan, action) };
    case "season-report":
      return limits.features.seasonReports
        ? { allowed: true }
        : { allowed: false, reason: getUpgradeReason(plan, action) };
    case "team-comparison":
      return limits.features.teamComparisonReport
        ? { allowed: true }
        : { allowed: false, reason: getUpgradeReason(plan, action) };
  }
}
