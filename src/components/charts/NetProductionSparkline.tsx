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

export interface SparkPoint {
  label: string;
  net: number;
}

export function NetProductionSparkline({ data }: { data: SparkPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-20 items-center text-xs text-slate-500">
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
          <ReferenceLine y={0} stroke="#2a3a5e" strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: "#2a3a5e" }}
            contentStyle={{
              background: "#121b30",
              border: "1px solid #1b2742",
              borderRadius: 6,
              fontSize: 12,
              color: "#dbe0e8",
            }}
            formatter={(value) => {
              const n = value as number;
              return [n > 0 ? `+${n}` : `${n}`, "Net"] as [string, string];
            }}
            labelStyle={{ color: "#8a97ad" }}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="#cbf03c"
            strokeWidth={2}
            dot={{ r: 3, fill: "#cbf03c" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
