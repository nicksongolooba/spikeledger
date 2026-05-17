import type { Position } from "@prisma/client";

export const POSITIONS: Position[] = ["OH", "RS", "OPP", "MB", "S", "L", "DS", "UTIL"];

export const POSITION_LABELS: Record<Position, string> = {
  OH: "Outside Hitter",
  RS: "Right Side",
  OPP: "Opposite",
  MB: "Middle Blocker",
  S: "Setter",
  L: "Libero",
  DS: "Defensive Specialist",
  UTIL: "Utility",
};

export type PositionGroup = "hitter" | "middle" | "setter" | "libero";

export const POSITION_GROUP: Record<Position, PositionGroup> = {
  OH: "hitter",
  RS: "hitter",
  OPP: "hitter",
  UTIL: "hitter",
  MB: "middle",
  S: "setter",
  L: "libero",
  DS: "libero",
};

// Tailwind class strings for position badges.
// Hitters: amber. Middles: violet. Setters: cyan. Liberos: emerald.
export const POSITION_BADGE_CLASS: Record<Position, string> = {
  OH: "bg-amber-400 text-amber-950",
  RS: "bg-amber-400 text-amber-950",
  OPP: "bg-amber-400 text-amber-950",
  UTIL: "bg-amber-400 text-amber-950",
  MB: "bg-violet-400 text-violet-950",
  S: "bg-cyan-400 text-cyan-950",
  L: "bg-emerald-400 text-emerald-950",
  DS: "bg-emerald-400 text-emerald-950",
};
