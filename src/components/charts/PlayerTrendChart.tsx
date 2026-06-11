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
          <CartesianGrid stroke="#1b2742" strokeDasharray="3 3" />
          <XAxis
            dataKey="tournamentName"
            stroke="#8a97ad"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#2a3a5e" }}
          />
          <YAxis
            yAxisId="left"
            stroke="#cbf03c"
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
              background: "#121b30",
              border: "1px solid #1b2742",
              borderRadius: 6,
              fontSize: 12,
              color: "#dbe0e8",
            }}
            labelStyle={{ color: "#8a97ad" }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="bankBalance"
            name="Bank Account"
            stroke="#cbf03c"
            strokeWidth={2}
            dot={{ r: 3, fill: "#cbf03c" }}
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
