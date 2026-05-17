import type { Position } from "@prisma/client";
import { POSITION_BADGE_CLASS } from "@/lib/positions";
import { cn } from "@/lib/utils";

export function PositionBadge({
  position,
  size = "sm",
  className,
}: {
  position: Position;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizeClass =
    size === "xs"
      ? "px-1.5 py-0.5 text-[10px]"
      : size === "md"
        ? "px-2.5 py-1 text-xs"
        : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-bold uppercase tracking-wide",
        POSITION_BADGE_CLASS[position],
        sizeClass,
        className,
      )}
    >
      {position}
    </span>
  );
}
