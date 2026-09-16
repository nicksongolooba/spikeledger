// Public report share links.
//
// A /share/[id] page needs no login. Anyone the link reaches can read it, and
// what it holds is a child's performance data. Three rules follow from that,
// and they live here so every surface applies the same ones:
//
//   1. Links expire. 30 days from the day they are made, after which the page
//      says so in neutral words instead of showing the report.
//   2. A coach can revoke one at any moment, which takes effect immediately.
//   3. Nothing public ever carries a full name. The page, the tab title, the
//      link preview and the coach's own copy button all use a first name and
//      a jersey number.
//
// The name rule is applied at render time rather than trusted from stored
// metadata, so a report saved before this existed is still shown safely.

export const SHARE_LINK_TTL_DAYS = 30;

export const SHARE_LINK_NOTICE =
  "Anyone with this link can view this report. It expires in 30 days.";

export const SHARE_EXPIRED_HEADLINE = "This report link has expired.";
export const SHARE_EXPIRED_BODY = "Ask your coach for a new one.";

export function shareExpiryFrom(from: Date = new Date()): Date {
  return new Date(from.getTime() + SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type ShareState = "active" | "expired" | "revoked";

export function shareState(
  report: { expiresAt: Date | string | null; revokedAt: Date | string | null },
  now: Date = new Date(),
): ShareState {
  if (report.revokedAt) return "revoked";
  // A row with no expiry predates this feature and the migration backfilled
  // it; treat a missing value as expired rather than as permanent.
  if (!report.expiresAt) return "expired";
  return new Date(report.expiresAt).getTime() > now.getTime() ? "active" : "expired";
}

export function daysLeft(expiresAt: Date | string | null, now: Date = new Date()): number {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

// What a public page is allowed to call a player: the first name and the
// jersey number, never the full name. "Sofia Adeyemi", 7 becomes "Sofia #7".
export function publicPlayerName(fullName: string | null | undefined, number: number | null): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const shown = first || "Player";
  return number === null || number === undefined ? shown : `${shown} #${number}`;
}
