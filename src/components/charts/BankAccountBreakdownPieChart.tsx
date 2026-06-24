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

interface Slice {
  key: string;
  label: string;
  value: number;
  fill: string;
}

const DEPOSIT_PALETTE = [
  "#34d399",
  "#cbf03c",
  "#a78bfa",
  "#10b981",
  "#60a5fa",
  "#6366f1",
];
const WITHDRAWAL_PALETTE = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#ef4444",
  "#f97316",
  "#eab308",
];

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
  const depositSlices = buildSlices(deposits, DEPOSIT_PALETTE);
  const withdrawalSlices = buildSlices(withdrawals, WITHDRAWAL_PALETTE);

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
  const totalColor = tone === "emerald" ? "text-emerald-300" : "text-red-300";
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </h4>
        <span className={`stat-number text-lg font-bold ${totalColor}`}>
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
                stroke="#121b30"
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={s.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#121b30",
                  border: "1px solid #1b2742",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#dbe0e8",
                }}
                formatter={(value, name) => [value as number, name as string]}
              />
              <Legend
                verticalAlign="bottom"
                height={28}
                wrapperStyle={{ fontSize: 11, color: "#8a97ad" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
