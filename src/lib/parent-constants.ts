// Client-safe constants for parent access (no prisma import here).
export const PARENT_CODE_MAX_REDEMPTIONS = 3;
export const PARENT_CODE_TTL_DAYS = 30;

export type ParentCodeState = "none" | "active" | "expired" | "exhausted";

export interface ParentCodeStatus {
  state: ParentCodeState;
  code: string | null;
  redemptions: number;
  max: number;
  expiresAt: Date | null;
}

// Where a player's code stands right now. `expired` wins over `exhausted`
// only when both apply, since either way the coach needs a fresh code.
export function parentCodeStatus(
  player: {
    parentCode: string | null;
    parentCodeRedemptions: number;
    parentCodeExpiresAt: Date | string | null;
  },
  now: Date = new Date(),
): ParentCodeStatus {
  const expiresAt = player.parentCodeExpiresAt ? new Date(player.parentCodeExpiresAt) : null;
  const base = {
    code: player.parentCode,
    redemptions: player.parentCodeRedemptions,
    max: PARENT_CODE_MAX_REDEMPTIONS,
    expiresAt,
  };
  if (!player.parentCode) return { ...base, state: "none" };
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return { ...base, state: "expired" };
  if (player.parentCodeRedemptions >= PARENT_CODE_MAX_REDEMPTIONS) return { ...base, state: "exhausted" };
  return { ...base, state: "active" };
}
