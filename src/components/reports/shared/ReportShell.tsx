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
  REPORT_ACCENT_ON_NAVY,
  REPORT_TEXT,
  REPORT_WIDTH,
} from "../cards/types";
import { LOGO_RATIO } from "@/components/layout/Wordmark";

// Position-group accent for the stripe under the header band. Same families
// as the position badges in src/lib/positions.ts: pin hitters navy, middles
// and setters steel blue and cyan, liberos green.
const GROUP_ACCENT: Record<PositionGroup, string> = {
  pin_hitter: "#1f3557",
  middle_blocker: "#0369a1",
  setter: "#0e7490",
  libero_ds: "#1b9757",
};

const HEADER_HEIGHT = 88;
const STRIPE_HEIGHT = 10;
// White-text logo on the navy band. Same-origin PNG, so html-to-image can
// inline it when the card is rasterised.
const LOGO_HEIGHT = 44;
const LOGO_WIDTH = Math.round(LOGO_HEIGHT * LOGO_RATIO);

interface Props {
  position: Position;
  // The shell draws an accent stripe under the header band - pass a rating
  // color (from BankAccountResult) and we use that instead, useful for the
  // Performance Overview card which is mostly about the rating.
  accentOverride?: string;
  cardKey: string; // header label, e.g. "01 OVERVIEW"
  // No-positions teams: navy stripe instead of a position-group color.
  neutral?: boolean;
  children: React.ReactNode;
}

export function ReportShell({ position, accentOverride, cardKey, neutral, children }: Props) {
  const accent =
    accentOverride ?? (neutral ? REPORT_NAVY : GROUP_ACCENT[POSITION_GROUP_MAP[position]]);

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-full-on-dark@2x.png"
          alt="SpikeLedger"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          style={{ display: "block", width: `${LOGO_WIDTH}px`, height: `${LOGO_HEIGHT}px` }}
        />
        <div
          style={{
            fontFamily: REPORT_FONT_DISPLAY,
            fontSize: "22px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: REPORT_ACCENT_ON_NAVY,
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
