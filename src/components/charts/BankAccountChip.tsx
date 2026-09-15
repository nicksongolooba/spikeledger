import type { BankAccountResult, Rating } from "@/engine/bank-account";
import { fmtSigned } from "@/engine/derived-stats";
import { cn } from "@/lib/utils";

// Light chip per rating tone. Written out in full so Tailwind picks them up.
const TONE: Record<Exclude<Rating, "GREY">, { chip: string; dot: string }> = {
  GREEN: {
    chip: "border-green-200 bg-green-50 text-green-700",
    dot: "bg-green-600",
  },
  BLUE: { chip: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-600" },
  ORANGE: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-600",
  },
  RED: { chip: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-600" },
};

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
          "inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500",
          className,
        )}
      >
        No data
      </span>
    );
  }
  const tone = TONE[result.rating];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-semibold",
        tone.chip,
        size === "sm" ? "text-[11px]" : "text-xs",
        className,
      )}
      title={`${result.ratingLabel} - ratio ${(result.ratio * 100).toFixed(0)}%`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      <span
        className={cn(
          "stat-number font-bold",
          size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        {fmtSigned(result.balance)}
      </span>
      <span className="hidden text-[10px] uppercase tracking-wide opacity-80 sm:inline">
        {result.rating}
      </span>
    </span>
  );
}
