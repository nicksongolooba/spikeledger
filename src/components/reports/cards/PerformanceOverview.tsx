import { POSITION_GROUP_MAP } from "@/engine/bank-account";
import { fmtNum, fmtPct, fmtSigned } from "@/engine/derived-stats";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import {
  REPORT_CARD_BG,
  REPORT_DIM,
  REPORT_MUTED,
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

      {/* Bank Account hero */}
      <div
        style={{
          marginTop: "44px",
          borderRadius: "24px",
          background: REPORT_CARD_BG,
          border: `2px solid ${ba.ratingColor}55`,
          padding: "32px 36px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${ba.ratingColor}1f 0%, transparent 50%)`,
          }}
        />
        <div style={{ position: "relative" }}>
          <div
            style={{
              fontSize: "16px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: REPORT_MUTED,
              fontWeight: 600,
            }}
          >
            Bank Account
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "20px",
              marginTop: "10px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "120px",
                fontWeight: 800,
                color: ba.ratingColor,
                lineHeight: 1,
              }}
            >
              {fmtSigned(ba.balance)}
            </span>
            <div>
              <span
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  background: `${ba.ratingColor}1f`,
                  border: `1px solid ${ba.ratingColor}66`,
                  color: ba.ratingColor,
                  fontSize: "22px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                {ba.rating}
              </span>
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "#dbe0e8",
                }}
              >
                {ba.ratingLabel}
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: "8px",
              fontSize: "16px",
              color: REPORT_DIM,
            }}
          >
            {ba.deposits} deposits · {ba.withdrawals} withdrawals ·{" "}
            {(ba.ratio * 100).toFixed(0)}% ratio
          </div>
          {data.aiSummary && (
            <div
              style={{
                marginTop: "16px",
                paddingTop: "16px",
                borderTop: "1px solid #1b2742",
                fontSize: "18px",
                lineHeight: 1.4,
                color: "#dbe0e8",
                fontStyle: "italic",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  marginRight: "8px",
                  padding: "2px 8px",
                  background: "rgba(167, 139, 250, 0.15)",
                  border: "1px solid rgba(167, 139, 250, 0.35)",
                  borderRadius: "6px",
                  color: "#c4b5fd",
                  fontSize: "11px",
                  fontStyle: "normal",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  verticalAlign: "middle",
                }}
              >
                ✨ AI Coach
              </span>
              {data.aiSummary}
            </div>
          )}
        </div>
      </div>

      {/* Stat callouts */}
      <div
        style={{
          marginTop: "36px",
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
              border: "1px solid #1b2742",
              borderRadius: "16px",
              padding: "18px 14px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "40px",
                fontWeight: 700,
                color: "#cbf03c",
                lineHeight: 1.1,
              }}
            >
              {c.value}
            </div>
            <div
              style={{
                marginTop: "8px",
                fontSize: "13px",
                color: REPORT_MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 600,
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
          paddingTop: "32px",
          borderTop: "1px solid #1b2742",
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
