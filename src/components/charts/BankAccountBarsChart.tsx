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
import { AXIS_LINE, AXIS_TICK, CHART } from "./chartTheme";

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
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lift">
      <div className="font-semibold text-slate-900">{d.name}</div>
      <div className="text-slate-600">
        {POSITION_LABELS[d.position]} · {d.ratingLabel}
      </div>
      <div className="stat-number mt-1 text-sm font-bold">
        Balance: <span style={{ color: d.ratingColor }}>{fmtSigned(d.balance)}</span>
        {"  "}
        Ratio: {(d.ratio * 100).toFixed(0)}%
      </div>
    </div>
  );
}

// Horizontal bar chart grouped by position group. The "fair comparison"
// principle: a Libero with low deposits doesn't have to be ranked against
// a hitter's kills column. Lazy-loaded via ./BankAccountBars.
export default function BankAccountBars({
  data,
  height,
}: {
  data: BankAccountBarDatum[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center text-sm text-slate-500">
        No Bank Account data yet - record some match stats first.
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
            <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {GROUP_TITLES[g]}
            </h3>
            <div style={{ width: "100%", height: height ?? chartHeight }}>
              <ResponsiveContainer>
                <BarChart
                  data={players}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                >
                  <CartesianGrid stroke={CHART.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={AXIS_LINE}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: CHART.ink, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={108}
                  />
                  <Tooltip
                    cursor={{ fill: CHART.cursor }}
                    content={<ChartTooltip />}
                  />
                  <Bar dataKey="balance" radius={[0, 4, 4, 0]}>
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
