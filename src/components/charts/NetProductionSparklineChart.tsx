"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  CHART,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  seriesActiveDot,
  seriesDot,
} from "./chartTheme";

export interface SparkPoint {
  label: string;
  net: number;
}

// Lazy-loaded via ./NetProductionSparkline.
export default function NetProductionSparkline({ data }: { data: SparkPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-20 items-center text-sm text-slate-500">
        Net production trend will appear after the first tournament.
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: 80 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <ReferenceLine y={0} stroke={CHART.zeroLine} strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: CHART.cursor }}
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(value) => {
              const n = value as number;
              return [n > 0 ? `+${n}` : `${n}`, "Net"] as [string, string];
            }}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke={CHART.primary}
            strokeWidth={2}
            dot={seriesDot(CHART.primary)}
            activeDot={seriesActiveDot(CHART.primary)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
