import type { Position } from "@prisma/client";
import { POSITION_BADGE_CLASS, POSITION_LABELS } from "@/lib/positions";
import { REPORT_MUTED } from "../cards/types";

// Tailwind classes don't survive html-to-image cleanly if applied to <span>
// in a hidden tree, so we derive inline colors from the badge class string.
function badgeColors(position: Position) {
  const cls = POSITION_BADGE_CLASS[position];
  if (cls.includes("amber")) return { bg: "#fbbf24", fg: "#451a03" };
  if (cls.includes("violet")) return { bg: "#a78bfa", fg: "#2e1065" };
  if (cls.includes("volt")) return { bg: "#cbf03c", fg: "#1a2403" };
  if (cls.includes("emerald")) return { bg: "#34d399", fg: "#022c22" };
  return { bg: "#8a97ad", fg: "#121b30" };
}

export function PlayerHeader({
  name,
  number,
  position,
  scopeLabel,
  teamName,
  secondaryPosition,
}: {
  name: string;
  number: number | null;
  position: Position;
  scopeLabel: string;
  teamName: string;
  secondaryPosition: Position | null;
}) {
  const colors = badgeColors(position);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "24px" }}>
      {number !== null && (
        <div
          style={{
            width: "96px",
            height: "96px",
            borderRadius: "20px",
            background: "#121b30",
            border: "2px solid #1b2742",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "48px",
              fontWeight: 700,
            }}
          >
            #{number}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "56px", fontWeight: 800, lineHeight: 1.05 }}>
          {name}
        </div>
        <div
          style={{
            marginTop: "10px",
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
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {position} · {POSITION_LABELS[position]}
          </span>
          {secondaryPosition && (
            <span
              style={{
                border: "1px solid #2a3a5e",
                color: REPORT_MUTED,
                padding: "5px 10px",
                borderRadius: "8px",
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
            color: REPORT_MUTED,
          }}
        >
          {teamName} · {scopeLabel}
        </div>
      </div>
    </div>
  );
}
