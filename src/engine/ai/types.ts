import type { Position } from "@prisma/client";
import type { BankAccountResult, PositionGroup } from "@/engine/bank-account";

export type InsightProvider = "anthropic" | "rule-based";

export interface PlayerInsightRequest {
  kind: "player";
  scope: "match" | "tournament" | "season";
  scopeId: string | null;       // matchId / tournamentId / null for season
  scopeLabel: string;           // human-readable, used in prompt
  ageGroup?: string | null;     // team's age group ("16U") - drives benchmarks
  player: {
    id: string;
    name: string;
    position: Position;          // evaluated-as position
    positionGroup: PositionGroup;
    primaryPosition: Position;
  };
  stats: Record<string, number>; // already filtered to position-appropriate numbers
  bankAccount: BankAccountResult;
  trend?: Array<{
    scopeLabel: string;
    stats: Record<string, number>;
    bankAccount: { balance: number; rating: string; ratingLabel: string };
  }>;
  teamContext?: {
    teamName: string;
    record: string;
    avgStats: Record<string, number>;
  };
}

export interface ImprovementInsight {
  area: string;
  currentValue: string;
  targetValue: string;
  drill: string;                // drill name + how it works
  duration?: string;            // e.g. "10 minutes per practice"
  reps?: string;                // e.g. "30 reps each" or "3 sets of 10"
  players?: string;             // e.g. "3 players" or "whole team"
  equipment?: string;           // e.g. "1 ball, net" or "None"
  youtubeQuery?: string;        // drill search terms only (no URLs); URL built in code
  explanation: string;
}

export interface PlayerInsightResponse {
  summary: string;
  strengths: string[];
  improvements: ImprovementInsight[];
  coachingNote: string;
  parentFriendly: string;
  provider: InsightProvider;
  cached: boolean;
  generatedAt: string;          // ISO timestamp
}

export interface TeamInsightRequest {
  kind: "team";
  scope: "tournament" | "season";
  scopeId: string | null;
  scopeLabel: string;
  ageGroup?: string | null;     // team's age group ("16U") - drives benchmarks
  team: { id: string; name: string };
  record: string;
  tournamentTrend: Array<{
    name: string;
    record: string;
    netProduction: number;
    srAverage: number;
    kills: number;
    errors: number;
  }>;
  playerBankAccounts: Array<{
    name: string;
    position: Position;
    balance: number;
    rating: string;
  }>;
}

export interface TeamInsightResponse {
  insights: string[];
  provider: InsightProvider;
  cached: boolean;
  generatedAt: string;
}
