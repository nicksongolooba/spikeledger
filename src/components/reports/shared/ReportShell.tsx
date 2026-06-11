import {
  POSITION_GROUP_MAP,
  type PositionGroup,
} from "@/engine/bank-account";
import type { Position } from "@prisma/client";
import {
  REPORT_BG,
  REPORT_HEIGHT,
  REPORT_TEXT,
  REPORT_WIDTH,
} from "../cards/types";

const GROUP_ACCENT: Record<PositionGroup, string> = {
  hitter: "#fbbf24",
  setter_middle: "#a78bfa",
  libero_ds: "#34d399",
};

interface Props {
  position: Position;
  // The shell positions an accent stripe down the left edge - pass a rating
  // color (from BankAccountResult) and we use that instead, useful for the
  // Performance Overview card which is mostly about the rating.
  accentOverride?: string;
  cardKey: string; // for the corner watermark, e.g. "01 / Overview"
  children: React.ReactNode;
}

export function ReportShell({ position, accentOverride, cardKey, children }: Props) {
  const accent = accentOverride ?? GROUP_ACCENT[POSITION_GROUP_MAP[position]];

  return (
    <div
      style={{
        width: `${REPORT_WIDTH}px`,
        height: `${REPORT_HEIGHT}px`,
        background: REPORT_BG,
        color: REPORT_TEXT,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Accent stripe down the left edge */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "10px",
          background: accent,
        }}
      />

      {/* Decorative gradient blobs */}
      <div
        style={{
          position: "absolute",
          width: "640px",
          height: "640px",
          top: "-220px",
          right: "-180px",
          background: `radial-gradient(circle, ${accent}1f 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "520px",
          height: "520px",
          bottom: "-200px",
          left: "-120px",
          background: "radial-gradient(circle, #cbf03c1a 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "56px 56px 48px 64px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>

      {/* Watermark / branding */}
      <div
        style={{
          position: "absolute",
          right: "32px",
          bottom: "24px",
          fontSize: "14px",
          fontWeight: 600,
          color: "#3c4f78",
          letterSpacing: "0.05em",
        }}
      >
        SPIKELEDGER · {cardKey}
      </div>
    </div>
  );
}
