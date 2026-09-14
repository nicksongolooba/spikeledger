import type { Position } from "@prisma/client";
import { POSITION_BADGE_CLASS, POSITION_LABELS } from "@/lib/positions";
import {
  REPORT_BG,
  REPORT_BORDER,
  REPORT_FONT_DISPLAY,
  REPORT_MUTED,
  REPORT_NAVY,
  REPORT_TEXT,
} from "../cards/types";

// Tailwind classes don't survive html-to-image cleanly if applied to <span>
// in a hidden tree, so we derive inline colors from the badge class string.
// Keep in sync with POSITION_BADGE_CLASS (navy / sky / orange / emerald).
function badgeColors(position: Position) {
  const cls = POSITION_BADGE_CLASS[position];
  if (cls.includes("navy")) return { bg: "#152743", fg: "#ffffff" };
  if (cls.includes("sky")) return { bg: "#0369a1", fg: "#ffffff" };
  if (cls.includes("orange")) return { bg: "#e4520b", fg: "#ffffff" };
  if (cls.includes("emerald")) return { bg: "#059669", fg: "#ffffff" };
  return { bg: "#475569", fg: "#ffffff" }; // slate fallback
}

export function PlayerHeader({
  name,
  number,
  position,
  scopeLabel,
  teamName,
  secondaryPosition,
  neutral = false,
}: {
  name: string;
  number: number | null;
  position: Position;
  scopeLabel: string;
  teamName: string;
  secondaryPosition: Position | null;
  // No-positions teams: a plain "Player · All-around" badge, no secondary.
  neutral?: boolean;
}) {
  const colors = neutral ? { bg: "#e2e8f0", fg: "#334155" } : badgeColors(position);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "24px" }}>
      {number !== null && (
        <div
          style={{
            width: "96px",
            height: "96px",
            borderRadius: "12px",
            background: REPORT_BG,
            border: `2px solid ${REPORT_BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: REPORT_FONT_DISPLAY,
              fontSize: "52px",
              fontWeight: 800,
              color: REPORT_NAVY,
              lineHeight: 1,
            }}
          >
            #{number}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: REPORT_FONT_DISPLAY,
            fontSize: "60px",
            fontWeight: 800,
            lineHeight: 1,
            color: REPORT_TEXT,
          }}
        >
          {name}
        </div>
        <div
          style={{
            marginTop: "12px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{
              background: colors.bg,
              color: colors.fg,
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {neutral ? "Player · All-around" : `${position} · ${POSITION_LABELS[position]}`}
          </span>
          {!neutral && secondaryPosition && (
            <span
              style={{
                background: REPORT_BG,
                border: `1px solid ${REPORT_BORDER}`,
                color: REPORT_MUTED,
                padding: "5px 10px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              also plays {secondaryPosition}
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: "12px",
            fontSize: "20px",
            fontWeight: 500,
            color: REPORT_MUTED,
          }}
        >
          {teamName} · {scopeLabel}
        </div>
      </div>
    </div>
  );
}
