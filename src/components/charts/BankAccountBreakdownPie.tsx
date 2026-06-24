"use client";

// Lazy wrapper around the Recharts pie implementation (code-split, client-only).
import dynamic from "next/dynamic";
import { ChartSkeleton } from "./ChartSkeleton";

export const BankAccountBreakdownPie = dynamic(
  () => import("./BankAccountBreakdownPieChart"),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartSkeleton className="h-56" />
        <ChartSkeleton className="h-56" />
      </div>
    ),
  },
);
