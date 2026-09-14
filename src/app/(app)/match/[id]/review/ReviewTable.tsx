"use client";

import { useMemo, useState } from "react";
import type { Position } from "@prisma/client";
import { ChevronDown, ChevronUp } from "lucide-react";
import { POSITION_GROUP_MAP, type Rating } from "@/engine/bank-account";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { BankAccountChip } from "@/components/charts/BankAccountChip";
import { fmtNum } from "@/engine/derived-stats";
import { cn } from "@/lib/utils";

export interface ReviewRow {
  playerId: string;
  name: string;
  number: number | null;
  position: Position;
  primaryPosition: Position;
  kills: number;
  attackErrors: number;
  aces: number;
  blocks: number;
  assists: number;
  digs: number;
  serveErrors: number;
  generalErrors: number;
  srAttempts: number;
  srAvg: number | null;
  totalErrors: number;
  balance: number;
  ratio: number;
  rating: Rating;
  ratingLabel: string;
  ratingColor: string;
}

type SortKey =
  | "name"
  | "kills"
  | "totalErrors"
  | "aces"
  | "blocks"
  | "assists"
  | "digs"
  | "srAvg"
  | "balance";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Player", align: "left" },
  { key: "kills", label: "K", align: "right" },
  { key: "totalErrors", label: "E", align: "right" },
  { key: "aces", label: "Aces", align: "right" },
  { key: "blocks", label: "Blk", align: "right" },
  { key: "assists", label: "Ast", align: "right" },
  { key: "digs", label: "Digs", align: "right" },
  { key: "srAvg", label: "SR Avg", align: "right" },
  { key: "balance", label: "Bank", align: "right" },
];

// Greying-out rules: position-inappropriate columns get muted.
function isMuted(row: ReviewRow, col: SortKey): boolean {
  const group = POSITION_GROUP_MAP[row.position];
  if (col === "srAvg") return group === "setter_middle"; // setters/middles aren't in SR
  if (col === "assists") return group !== "setter_middle"; // only setters/middles set
  if (col === "blocks") return group === "libero_ds"; // liberos don't block
  if (col === "kills") return group === "libero_ds"; // liberos don't attack
  return false;
}

export function ReviewTable({ rows }: { rows: ReviewRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "balance",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const dirMul = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === "name") {
        return a.name.localeCompare(b.name) * dirMul;
      }
      const av = (a as unknown as Record<string, unknown>)[sort.key];
      const bv = (b as unknown as Record<string, unknown>)[sort.key];
      const an = typeof av === "number" ? av : av === null ? -Infinity : 0;
      const bn = typeof bv === "number" ? bv : bv === null ? -Infinity : 0;
      return (an - bn) * dirMul;
    });
  }, [rows, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "cursor-pointer select-none whitespace-nowrap px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition-colors hover:text-slate-900",
                  c.align === "right" ? "text-right" : "text-left",
                  sort.key === c.key ? "text-cyan-700" : "text-slate-500",
                )}
                onClick={() => toggleSort(c.key)}
                role="button"
              >
                <span className="inline-flex items-center gap-0.5">
                  {c.label}
                  {sort.key === c.key &&
                    (sort.dir === "asc" ? (
                      <ChevronUp size={12} strokeWidth={2.5} aria-hidden />
                    ) : (
                      <ChevronDown size={12} strokeWidth={2.5} aria-hidden />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((r) => (
            <tr key={r.playerId} className="transition-colors hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="stat-number w-7 text-center text-xs font-bold text-slate-500">
                    {r.number !== null ? `#${r.number}` : "-"}
                  </span>
                  <span className="font-semibold text-slate-900">{r.name}</span>
                  <PositionBadge position={r.position} size="xs" />
                </div>
              </td>
              {COLUMNS.slice(1).map((c) => {
                const muted = isMuted(r, c.key);
                if (c.key === "balance") {
                  return (
                    <td key={c.key} className="px-3 py-2.5 text-right">
                      <BankAccountChip
                        result={{
                          balance: r.balance,
                          deposits: 0,
                          withdrawals: 0,
                          ratio: r.ratio,
                          rating: r.rating,
                          ratingLabel: r.ratingLabel,
                          ratingColor: r.ratingColor,
                          depositBreakdown: {},
                          withdrawalBreakdown: {},
                          positionGroup: null,
                        }}
                        size="sm"
                      />
                    </td>
                  );
                }
                let value: string | number = (r as unknown as Record<string, unknown>)[
                  c.key
                ] as number;
                if (c.key === "srAvg") {
                  value = r.srAvg === null ? "-" : fmtNum(r.srAvg, 2);
                }
                return (
                  <td
                    key={c.key}
                    className={cn(
                      "stat-number whitespace-nowrap px-3 py-2.5 text-right text-base tabular-nums",
                      muted ? "text-slate-400" : "text-slate-900",
                    )}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
