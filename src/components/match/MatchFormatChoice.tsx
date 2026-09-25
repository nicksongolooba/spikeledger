"use client";

import { cn } from "@/lib/utils";
import type { BestOf } from "@/engine/win-probability";

export const FORMAT_LABEL: Record<BestOf, string> = { 3: "Best of 3", 5: "Best of 5" };
const FORMAT_HELP: Record<BestOf, string> = {
  3: "Sets 1 and 2 to 25, set 3 to 15. First to 2 sets.",
  5: "Sets 1 to 4 to 25, set 5 to 15. First to 3 sets.",
};

// Best of 3 or best of 5, as two cards. Used when adding a match and when the
// coach changes the format on the courtside page.
export function MatchFormatChoice({
  value,
  onChange,
}: {
  value: BestOf;
  onChange: (bestOf: BestOf) => void;
}) {
  return (
    <fieldset>
      <legend className="label">Format</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {([3, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            data-format-option={n}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={cn(
              "rounded-md border-2 px-3 py-2.5 text-left transition-colors",
              value === n ? "border-navy-900 bg-navy-50" : "border-slate-200 bg-white hover:border-slate-400",
            )}
          >
            <span className="block font-semibold text-slate-900">{FORMAT_LABEL[n]}</span>
            <span className="block text-xs text-slate-600">{FORMAT_HELP[n]}</span>
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">Every set is win by 2, with no cap.</p>
    </fieldset>
  );
}
