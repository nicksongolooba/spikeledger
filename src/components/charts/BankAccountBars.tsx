"use client";

// Lazy wrapper: Recharts is heavy, so the implementation is code-split and
// loaded on the client only (ssr: false) with a skeleton fallback.
import dynamic from "next/dynamic";
import { ChartSkeleton } from "./ChartSkeleton";

export type { BankAccountBarDatum } from "./BankAccountBarsChart";

export const BankAccountBars = dynamic(
  () => import("./BankAccountBarsChart"),
  { ssr: false, loading: () => <ChartSkeleton className="h-40" /> },
);
