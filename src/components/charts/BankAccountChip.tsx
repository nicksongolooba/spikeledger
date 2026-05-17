import type { BankAccountResult } from "@/engine/bank-account";
import { fmtSigned } from "@/engine/derived-stats";
import { cn } from "@/lib/utils";

// Compact rating chip used in tables and player lists.
export function BankAccountChip({
  result,
  size = "md",
  className,
}: {
  result: BankAccountResult;
  size?: "sm" | "md";
  className?: string;
}) {
  if (result.rating === "GREY") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-xs text-slate-500",
          className,
        )}
      >
        — no data
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-semibold",
        size === "sm" ? "text-[11px]" : "text-xs",
        className,
      )}
      style={{
        color: result.ratingColor,
        borderColor: `${result.ratingColor}55`,
        backgroundColor: `${result.ratingColor}1a`,
      }}
      title={`${result.ratingLabel} · ratio ${(result.ratio * 100).toFixed(0)}%`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: result.ratingColor }}
      />
      <span className="stat-number">{fmtSigned(result.balance)}</span>
      <span className="hidden text-[10px] uppercase tracking-wide opacity-80 sm:inline">
        {result.rating}
      </span>
    </span>
  );
}
