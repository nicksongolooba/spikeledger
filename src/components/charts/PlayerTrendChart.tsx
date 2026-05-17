"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  tournamentName: string;
  bankBalance: number;
  primary: number; // position-appropriate primary metric (kills/match, SR avg, assists/match, blocks/match)
}

export function PlayerTrendChart({
  data,
  primaryLabel,
  primaryColor,
}: {
  data: TrendPoint[];
  primaryLabel: string;
  primaryColor: string;
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
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="tournamentName"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            yAxisId="left"
            stroke="#22d3ee"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke={primaryColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 6,
              fontSize: 12,
              color: "#e2e8f0",
            }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="bankBalance"
            name="Bank Account"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 3, fill: "#22d3ee" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="primary"
            name={primaryLabel}
            stroke={primaryColor}
            strokeWidth={2}
            dot={{ r: 3, fill: primaryColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
