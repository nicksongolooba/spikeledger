import type { CSSProperties } from "react";

// Shared Recharts styling for the light "Scoreboard" palette. Recharts paints
// SVG, so it needs literal colors - these mirror the tokens in
// tailwind.config.ts (cyan/green from the logo) and Tailwind's stock slate/red.
export const CHART = {
  primary: "#0b1a33", // navy-900 - main series
  secondary: "#00cafd", // cyan-500, the logo cyan - second series
  tertiary: "#25e380", // green-500, the logo green - third series
  positive: "#1b9757", // green-600 - deposits
  negative: "#dc2626", // red-600 - withdrawals
  neutral: "#b9c8de", // navy-200 - bars with no rating
  grid: "#e2e8f0", // slate-200
  axisLine: "#cbd5e1", // slate-300
  tick: "#64748b", // slate-500
  zeroLine: "#94a3b8", // slate-400
  cursor: "#f1f5f9", // slate-100
  legend: "#475569", // slate-600
  ink: "#0f172a", // slate-900
  white: "#ffffff",
} as const;

// Pie ramps: darkest stop for the biggest slice. Brand green / stock red,
// 800 down to 200 (the 400 stops are skipped so the two ramps stay apart).
export const DEPOSIT_RAMP = [
  "#17633c",
  "#1a7f4a",
  "#1b9757",
  "#25e380",
  "#6eecab",
  "#a5f3ca",
];
export const WITHDRAWAL_RAMP = [
  "#991b1b",
  "#b91c1c",
  "#dc2626",
  "#ef4444",
  "#fca5a5",
  "#fecaca",
];

export const AXIS_TICK = { fill: CHART.tick, fontSize: 11 } as const;
export const AXIS_LINE = { stroke: CHART.axisLine } as const;

export const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  background: CHART.white,
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  color: CHART.ink,
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgba(11,26,51,0.25)",
};
export const TOOLTIP_LABEL_STYLE: CSSProperties = { color: CHART.tick };
export const TOOLTIP_ITEM_STYLE: CSSProperties = { color: CHART.ink };

export const LEGEND_WRAPPER_STYLE: CSSProperties = {
  fontSize: 11,
  color: CHART.legend,
};

// Recharts colors legend text with the series color; force it to slate so the
// light ramp stops stay readable on white.
export function legendText(value: unknown) {
  return <span style={{ color: CHART.legend }}>{String(value)}</span>;
}

export function seriesDot(color: string) {
  return { r: 3, fill: color, stroke: CHART.white, strokeWidth: 1.5 };
}

export function seriesActiveDot(color: string) {
  return { r: 5, fill: color, stroke: CHART.white, strokeWidth: 2 };
}
