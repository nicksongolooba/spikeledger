"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_LINE,
  AXIS_TICK,
  CHART,
  LEGEND_WRAPPER_STYLE,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  legendText,
  seriesActiveDot,
  seriesDot,
} from "./chartTheme";

export interface TrendPoint {
  tournamentName: string;
  bankBalance: number;
  primary: number; // position-appropriate primary metric (kills/match, SR avg, assists/match, blocks/match)
}

// Lazy-loaded via ./PlayerTrendChart. Bank Account is the navy line on the
// left axis; the position metric is the orange line on the right axis.
export default function PlayerTrendChart({
  data,
  primaryLabel,
  primaryColor = CHART.secondary,
}: {
  data: TrendPoint[];
  primaryLabel: string;
  primaryColor?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-500">
        No tournament data yet.
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 16, bottom: 6, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="tournamentName"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
          />
          <YAxis
            yAxisId="left"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: CHART.cursor }}
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={24}
            iconType="plainline"
            iconSize={12}
            wrapperStyle={LEGEND_WRAPPER_STYLE}
            formatter={legendText}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="bankBalance"
            name="Bank Account"
            stroke={CHART.primary}
            strokeWidth={2}
            dot={seriesDot(CHART.primary)}
            activeDot={seriesActiveDot(CHART.primary)}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="primary"
            name={primaryLabel}
            stroke={primaryColor}
            strokeWidth={2}
            dot={seriesDot(primaryColor)}
            activeDot={seriesActiveDot(primaryColor)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
