import {
  POSITION_GROUP_MAP,
  type PositionGroup,
} from "@/engine/bank-account";
import type { Position } from "@prisma/client";
import {
  REPORT_BG,
  REPORT_DIM,
  REPORT_FONT,
  REPORT_FONT_DISPLAY,
  REPORT_HEIGHT,
  REPORT_NAVY,
  REPORT_ORANGE_LIGHT,
  REPORT_TEXT,
  REPORT_WIDTH,
} from "../cards/types";

// Position-group accent for the stripe under the header band. Same families
// as the position badges in src/lib/positions.ts: hitters navy, setters and
// middles steel blue, liberos green.
const GROUP_ACCENT: Record<PositionGroup, string> = {
  hitter: "#1f3557",
  setter_middle: "#0369a1",
  libero_ds: "#059669",
};

const HEADER_HEIGHT = 88;
const STRIPE_HEIGHT = 10;

interface Props {
  position: Position;
  // The shell draws an accent stripe under the header band - pass a rating
  // color (from BankAccountResult) and we use that instead, useful for the
  // Performance Overview card which is mostly about the rating.
  accentOverride?: string;
  cardKey: string; // header label, e.g. "01 OVERVIEW"
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
        fontFamily: REPORT_FONT,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Navy header band: wordmark left, card label right */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: `${HEADER_HEIGHT}px`,
          background: REPORT_NAVY,
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 56px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontFamily: REPORT_FONT_DISPLAY,
            fontSize: "30px",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          <span style={{ fontWeight: 800 }}>Spike</span>
          <span style={{ fontWeight: 500 }}>Ledger</span>
        </div>
        <div
          style={{
            fontFamily: REPORT_FONT_DISPLAY,
            fontSize: "22px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: REPORT_ORANGE_LIGHT,
            lineHeight: 1,
          }}
        >
          {cardKey}
        </div>
      </div>

      {/* Position-group accent stripe along the bottom edge of the band */}
      <div
        style={{
          position: "absolute",
          top: `${HEADER_HEIGHT}px`,
          left: 0,
          right: 0,
          height: `${STRIPE_HEIGHT}px`,
          background: accent,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: `${HEADER_HEIGHT + STRIPE_HEIGHT + 44}px 56px 56px 56px`,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>

      {/* Footer watermark */}
      <div
        style={{
          position: "absolute",
          right: "56px",
          bottom: "22px",
          fontFamily: REPORT_FONT_DISPLAY,
          fontSize: "14px",
          fontWeight: 600,
          color: REPORT_DIM,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        spikeledger.com
      </div>
    </div>
  );
}
