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
          <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: "#334155" }}
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 6,
              fontSize: 12,
              color: "#e2e8f0",
            }}
            formatter={(value) => {
              const n = value as number;
              return [n > 0 ? `+${n}` : `${n}`, "Net"] as [string, string];
            }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 3, fill: "#22d3ee" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
