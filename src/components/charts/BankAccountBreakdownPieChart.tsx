"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { BREAKDOWN_LABELS } from "@/engine/bank-account";
import {
  CHART,
  DEPOSIT_RAMP,
  LEGEND_WRAPPER_STYLE,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  WITHDRAWAL_RAMP,
  legendText,
} from "./chartTheme";

interface Slice {
  key: string;
  label: string;
  value: number;
  fill: string;
}

function buildSlices(
  breakdown: Record<string, number>,
  palette: string[],
): Slice[] {
  return Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value], i) => ({
      key,
      label: BREAKDOWN_LABELS[key] ?? key,
      value,
      fill: palette[i % palette.length],
    }));
}

// Lazy-loaded via ./BankAccountBreakdownPie.
export default function BankAccountBreakdownPie({
  deposits,
  withdrawals,
}: {
  deposits: Record<string, number>;
  withdrawals: Record<string, number>;
}) {
  const depositSlices = buildSlices(deposits, DEPOSIT_RAMP);
  const withdrawalSlices = buildSlices(withdrawals, WITHDRAWAL_RAMP);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <PieCard title="Deposits" total={sum(depositSlices)} slices={depositSlices} tone="emerald" />
      <PieCard title="Withdrawals" total={sum(withdrawalSlices)} slices={withdrawalSlices} tone="red" />
    </div>
  );
}

function sum(slices: Slice[]) {
  return slices.reduce((s, x) => s + x.value, 0);
}

function PieCard({
  title,
  total,
  slices,
  tone,
}: {
  title: string;
  total: number;
  slices: Slice[];
  tone: "emerald" | "red";
}) {
  const totalColor = tone === "emerald" ? "text-green-700" : "text-red-700";
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-display text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          {title}
        </h4>
        <span className={`stat-number text-2xl font-bold ${totalColor}`}>
          {total}
        </span>
      </div>
      {slices.length === 0 ? (
        <div className="flex h-44 items-center justify-center text-xs text-slate-500">
          No {title.toLowerCase()} yet.
        </div>
      ) : (
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                stroke={CHART.white}
                strokeWidth={2}
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={s.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                formatter={(value, name) => [value as number, name as string]}
              />
              <Legend
                verticalAlign="bottom"
                height={28}
                wrapperStyle={LEGEND_WRAPPER_STYLE}
                formatter={legendText}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
