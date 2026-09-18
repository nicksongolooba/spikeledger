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

// The one definition of a position group. The engine used to carry a second,
// three-way version of this and the bar chart a third; both now read this.
//
// "Pin hitter" rather than "hitter": a middle is a hitter too, so a category
// called Hitters that excludes middles is wrong volleyball, and every
// experienced coach reading it notices. "Middle blocker" rather than "middle"
// because middle is also a place on the court, and pairing it with pin hitter
// keeps both names describing the job rather than the location.
export type PositionGroup = "pin_hitter" | "middle_blocker" | "setter" | "libero_ds";

export const POSITION_GROUP: Record<Position, PositionGroup> = {
  OH: "pin_hitter",
  RS: "pin_hitter",
  OPP: "pin_hitter",
  UTIL: "pin_hitter",
  MB: "middle_blocker",
  S: "setter",
  L: "libero_ds",
  DS: "libero_ds",
};

// Every place a coach reads a group name.
export const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  pin_hitter: "Pin hitters",
  middle_blocker: "Middle blockers",
  setter: "Setters",
  libero_ds: "Liberos / DS",
};

// Display order, front row job first, then the back row specialists.
export const POSITION_GROUP_ORDER: PositionGroup[] = [
  "pin_hitter",
  "middle_blocker",
  "setter",
  "libero_ds",
];

export function positionGroupOf(position: Position): PositionGroup {
  return POSITION_GROUP[position];
}

// Tailwind class strings for position badges. Four position groups, four
// solid chips: hitters navy, middles steel blue, setters cyan (they run the
// offense, so they get the accent), liberos green. Report cards derive their
// inline colors from these strings, so keep the color names in sync.
export const POSITION_BADGE_CLASS: Record<Position, string> = {
  OH: "bg-navy-800 text-white",
  RS: "bg-navy-800 text-white",
  OPP: "bg-navy-800 text-white",
  UTIL: "bg-navy-800 text-white",
  MB: "bg-sky-700 text-white",
  S: "bg-cyan-500 text-navy-950",
  L: "bg-green-600 text-white",
  DS: "bg-green-600 text-white",
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
