"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Position } from "@prisma/client";
import { POSITION_GROUP_MAP, type PositionGroup } from "@/engine/bank-account";
import { POSITION_LABELS } from "@/lib/positions";
import { fmtSigned } from "@/engine/derived-stats";

export interface BankAccountBarDatum {
  name: string;          // display name (e.g. "Maya #7")
  balance: number;
  ratio: number;
  rating: string;
  ratingLabel: string;
  ratingColor: string;
  position: Position;
}

const GROUP_ORDER: PositionGroup[] = ["hitter", "setter_middle", "libero_ds"];

const GROUP_TITLES: Record<PositionGroup, string> = {
  hitter: "Hitters",
  setter_middle: "Setters & Middles",
  libero_ds: "Liberos / DS",
};

function ChartTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: BankAccountBarDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-slate-100">{d.name}</div>
      <div className="text-slate-400">
        {POSITION_LABELS[d.position]} · {d.ratingLabel}
      </div>
      <div className="mt-1 font-mono">
        Balance: <span style={{ color: d.ratingColor }}>{fmtSigned(d.balance)}</span>
        {"  "}
        Ratio: {(d.ratio * 100).toFixed(0)}%
      </div>
    </div>
  );
}

// Horizontal bar chart grouped by position group. The "fair comparison"
// principle: a Libero with low deposits doesn't have to be ranked against
// a hitter's kills column.
export function BankAccountBars({
  data,
  height,
}: {
  data: BankAccountBarDatum[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center text-sm text-slate-500">
        No Bank Account data yet — record some match stats first.
      </div>
    );
  }

  const byGroup: Record<PositionGroup, BankAccountBarDatum[]> = {
    hitter: [],
    setter_middle: [],
    libero_ds: [],
  };
  for (const d of data) byGroup[POSITION_GROUP_MAP[d.position]].push(d);
  // Sort within each group: highest balance first.
  for (const g of GROUP_ORDER) byGroup[g].sort((a, b) => b.balance - a.balance);

  return (
    <div className="space-y-4">
      {GROUP_ORDER.map((g) => {
        const players = byGroup[g];
        if (players.length === 0) return null;
        const rowHeight = 36;
        const chartHeight = Math.max(
          110,
          players.length * rowHeight + 48,
        );
        return (
          <div key={g} className="card p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {GROUP_TITLES[g]}
            </h3>
            <div style={{ width: "100%", height: height ?? chartHeight }}>
              <ResponsiveContainer>
                <BarChart
                  data={players}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                >
                  <CartesianGrid stroke="#1e293b" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#cbd5e1"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={108}
                  />
                  <Tooltip
                    cursor={{ fill: "#1e293b40" }}
                    content={<ChartTooltip />}
                  />
                  <Bar dataKey="balance" radius={[0, 6, 6, 0]}>
                    {players.map((p, i) => (
                      <Cell key={i} fill={p.ratingColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
