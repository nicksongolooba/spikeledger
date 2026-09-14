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

// Tailwind class strings for position badges. Four position groups, four
// solid chips: hitters navy, middles steel blue, setters orange (they run the
// offense, so they get the accent), liberos green. Report cards derive their
// inline colors from these strings, so keep the color names in sync.
export const POSITION_BADGE_CLASS: Record<Position, string> = {
  OH: "bg-navy-800 text-white",
  RS: "bg-navy-800 text-white",
  OPP: "bg-navy-800 text-white",
  UTIL: "bg-navy-800 text-white",
  MB: "bg-sky-700 text-white",
  S: "bg-orange-500 text-white",
  L: "bg-emerald-600 text-white",
  DS: "bg-emerald-600 text-white",
};

// No-positions teams show every player as a plain "Player" instead of a
// position. Use these helpers wherever a label or badge is rendered so the
// choice is made in one place.
export const NO_POSITION_LABEL = "Player";
export function positionLabel(position: Position, usesPositions: boolean): string {
  return usesPositions ? POSITION_LABELS[position] : NO_POSITION_LABEL;
}

// Suggested positions-mode default when a coach creates a team: younger age
// groups usually rotate everyone through everything.
export function suggestUsesPositions(ageGroup: string | null | undefined): boolean {
  const n = parseInt(ageGroup?.match(/\d{1,2}/)?.[0] ?? "", 10);
  if (!Number.isFinite(n)) return true;
  return n >= 15;
}
