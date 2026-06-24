"use client";

// Lazy wrapper around the Recharts sparkline (code-split, client-only).
import dynamic from "next/dynamic";
import { ChartSkeleton } from "./ChartSkeleton";

export type { SparkPoint } from "./NetProductionSparklineChart";

export const NetProductionSparkline = dynamic(
  () => import("./NetProductionSparklineChart"),
  { ssr: false, loading: () => <ChartSkeleton className="h-20" /> },
);
