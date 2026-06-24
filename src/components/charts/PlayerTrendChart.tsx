"use client";

// Lazy wrapper around the Recharts line chart (code-split, client-only).
import dynamic from "next/dynamic";
import { ChartSkeleton } from "./ChartSkeleton";

export type { TrendPoint } from "./PlayerTrendLineChart";

export const PlayerTrendChart = dynamic(
  () => import("./PlayerTrendLineChart"),
  { ssr: false, loading: () => <ChartSkeleton className="h-[280px]" /> },
);
