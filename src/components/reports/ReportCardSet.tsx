import { PerformanceOverview } from "./cards/PerformanceOverview";
import { YourNumbers } from "./cards/YourNumbers";
import { WhatToWorkOn } from "./cards/WhatToWorkOn";
import { BankAccountCard } from "./cards/BankAccountCard";
import { BreakdownPie } from "./cards/BreakdownPie";
import { TeamComparison } from "./cards/TeamComparison";
import type { ReportCardData } from "./cards/types";

export type ReportCardKey =
  | "overview"
  | "numbers"
  | "work-on"
  | "bank"
  | "breakdown"
  | "comparison";

export const REPORT_CARDS: {
  key: ReportCardKey;
  label: string;
  caption: string;
  hint?: string;
}[] = [
  {
    key: "overview",
    label: "Performance Overview",
    caption: "Bank Account + headline stats",
  },
  { key: "numbers", label: "Your Numbers", caption: "Full stat breakdown" },
  {
    key: "work-on",
    label: "What To Work On",
    caption: "Top 3 focus areas with drills",
  },
  {
    key: "bank",
    label: "Bank Account",
    caption: "Deposits vs withdrawals",
  },
  {
    key: "breakdown",
    label: "Breakdown",
    caption: "Where deposits/withdrawals come from",
  },
  {
    key: "comparison",
    label: "Team Comparison",
    caption: "Rank within position group",
    hint: "Shows how this player ranks vs teammates at the same position. Some coaches share this only privately.",
  },
];

export function ReportCardByKey({
  data,
  cardKey,
}: {
  data: ReportCardData;
  cardKey: ReportCardKey;
}) {
  switch (cardKey) {
    case "overview":
      return <PerformanceOverview data={data} />;
    case "numbers":
      return <YourNumbers data={data} />;
    case "work-on":
      return <WhatToWorkOn data={data} />;
    case "bank":
      return <BankAccountCard data={data} />;
    case "breakdown":
      return <BreakdownPie data={data} />;
    case "comparison":
      return <TeamComparison data={data} />;
  }
}
