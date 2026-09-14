import { POSITION_GROUP_MAP } from "@/engine/bank-account";
import { fmtNum, fmtPct, fmtSigned } from "@/engine/derived-stats";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import {
  REPORT_BG,
  REPORT_BODY,
  REPORT_BORDER,
  REPORT_CARD_BG,
  REPORT_FONT_DISPLAY,
  REPORT_MUTED,
  REPORT_NAVY,
  REPORT_ACCENT_DEEP,
  REPORT_TEXT,
  type ReportCardData,
} from "./types";

interface Callout {
  label: string;
  value: string;
}

function calloutsFor(data: ReportCardData): Callout[] {
  const s = data.stats;
  const group = POSITION_GROUP_MAP[data.player.position];
  if (group === "libero_ds") {
    return [
      { label: "SR Avg", value: s.srTotal > 0 ? fmtNum(s.srAverage, 2) : "-" },
      { label: "Perfect Pass %", value: s.srTotal > 0 ? fmtPct(s.perfectPassPercentage, 0) : "-" },
      { label: "Digs / Match", value: fmtNum(s.digsPerMatch, 1) },
      { label: "Aces / Match", value: fmtNum(s.acesPerMatch, 1) },
      { label: "Errors / Match", value: fmtNum(s.errorsPerMatch, 1) },
    ];
  }
  if (group === "setter_middle") {
    return [
      { label: "Assists / Match", value: fmtNum(s.assistsPerMatch, 1) },
      { label: "Blocks / Match", value: fmtNum(s.blocksPerMatch, 1) },
      { label: "Kills / Match", value: fmtNum(s.killsPerMatch, 1) },
      { label: "Aces / Match", value: fmtNum(s.acesPerMatch, 1) },
      { label: "Errors / Match", value: fmtNum(s.errorsPerMatch, 1) },
    ];
  }
  return [
    { label: "Kills / Match", value: fmtNum(s.killsPerMatch, 1) },
    {
      label: "Hitting %",
      value:
        s.totalKills + s.totalAttackErrors > 0
          ? fmtPct(s.hittingEfficiency, 1)
          : "-",
    },
    { label: "Aces / Match", value: fmtNum(s.acesPerMatch, 1) },
    { label: "SR Avg", value: s.srTotal > 0 ? fmtNum(s.srAverage, 2) : "-" },
    { label: "Errors / Match", value: fmtNum(s.errorsPerMatch, 1) },
  ];
}

export function PerformanceOverview({ data }: { data: ReportCardData }) {
  const ba = data.bankAccount;
  const callouts = calloutsFor(data);
  return (
    <ReportShell
      position={data.player.position}
      accentOverride={ba.ratingColor}
      cardKey="01 OVERVIEW"
    >
      <PlayerHeader
        name={data.player.name}
        number={data.player.number}
        position={data.player.position}
        scopeLabel={data.scopeLabel}
        teamName={data.team.name}
        secondaryPosition={data.player.secondaryPosition}
      />

      {/* Bank Account hero - the rating color carries the top rule, the big number and the pill */}
      <div
        style={{
          marginTop: "40px",
          borderRadius: "12px",
          background: REPORT_BG,
          border: `1px solid ${REPORT_BORDER}`,
          borderTop: `8px solid ${ba.ratingColor}`,
          padding: "28px 36px 30px",
        }}
      >
        <div
          style={{
            fontFamily: REPORT_FONT_DISPLAY,
            fontSize: "16px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: REPORT_ACCENT_DEEP,
            fontWeight: 700,
          }}
        >
          Bank Account
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "24px",
            marginTop: "8px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: REPORT_FONT_DISPLAY,
              fontSize: "136px",
              fontWeight: 800,
              color: ba.ratingColor,
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
            }}
          >
            {fmtSigned(ba.balance)}
          </span>
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: "6px",
                background: ba.ratingColor,
                color: "#ffffff",
                fontFamily: REPORT_FONT_DISPLAY,
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1.1,
              }}
            >
              {ba.rating}
            </span>
            <div
              style={{
                marginTop: "10px",
                fontSize: "22px",
                fontWeight: 600,
                color: REPORT_TEXT,
              }}
            >
              {ba.ratingLabel}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: "10px",
            fontSize: "16px",
            color: REPORT_MUTED,
          }}
        >
          {ba.deposits} deposits · {ba.withdrawals} withdrawals ·{" "}
          {(ba.ratio * 100).toFixed(0)}% ratio
        </div>
        {data.aiSummary && (
          <div
            style={{
              marginTop: "18px",
              paddingTop: "18px",
              borderTop: `1px solid ${REPORT_BORDER}`,
              fontSize: "18px",
              lineHeight: 1.45,
              color: REPORT_BODY,
            }}
          >
            <span
              style={{
                display: "inline-block",
                marginRight: "10px",
                padding: "3px 10px",
                background: REPORT_NAVY,
                borderRadius: "999px",
                color: "#ffffff",
                fontFamily: REPORT_FONT_DISPLAY,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                verticalAlign: "middle",
              }}
            >
              AI summary
            </span>
            {data.aiSummary}
          </div>
        )}
      </div>

      {/* Stat callouts */}
      <div
        style={{
          marginTop: "32px",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "14px",
        }}
      >
        {callouts.map((c) => (
          <div
            key={c.label}
            style={{
              background: REPORT_CARD_BG,
              border: `1px solid ${REPORT_BORDER}`,
              borderRadius: "12px",
              padding: "20px 12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: REPORT_FONT_DISPLAY,
                fontSize: "52px",
                fontWeight: 700,
                color: REPORT_NAVY,
                lineHeight: 1,
              }}
            >
              {c.value}
            </div>
            <div
              style={{
                marginTop: "10px",
                fontFamily: REPORT_FONT_DISPLAY,
                fontSize: "15px",
                color: REPORT_MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 700,
              }}
            >
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {/* Footer summary */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "24px",
          borderTop: `1px solid ${REPORT_BORDER}`,
          display: "flex",
          justifyContent: "space-between",
          fontSize: "16px",
          color: REPORT_MUTED,
        }}
      >
        <span>
          {data.stats.matchesPlayed} matches · {data.stats.setsPlayed} sets
        </span>
        <span>Position-fair evaluation</span>
      </div>
    </ReportShell>
  );
}
