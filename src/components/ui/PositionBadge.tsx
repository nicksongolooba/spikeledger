import type { Position } from "@prisma/client";
import { POSITION_BADGE_CLASS } from "@/lib/positions";
import { cn } from "@/lib/utils";

// Position chip. Pass `neutral` on teams that play without set positions and
// it renders a plain "PLAYER" chip instead of the position code.
export function PositionBadge({
  position,
  size = "sm",
  className,
  neutral = false,
}: {
  position: Position;
  size?: "xs" | "sm" | "md";
  className?: string;
  neutral?: boolean;
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
        "inline-flex items-center rounded font-display font-bold uppercase tracking-wider",
        neutral ? "bg-slate-200 text-slate-700" : POSITION_BADGE_CLASS[position],
        sizeClass,
        className,
      )}
    >
      {neutral ? "Player" : position}
    </span>
  );
}
