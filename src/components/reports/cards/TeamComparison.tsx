import { fmtNum } from "@/engine/derived-stats";
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
  REPORT_NAVY_LIGHT,
  REPORT_ORANGE,
  REPORT_ORANGE_DEEP,
  REPORT_ORANGE_TINT,
  type ReportCardData,
} from "./types";

interface ChartRow {
  player: string;
  value: number;
  isMe: boolean;
}

function chart(rows: ChartRow[], label: string, fmt: (n: number) => string) {
  const max = Math.max(0.001, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div
      style={{
        background: REPORT_BG,
        border: `1px solid ${REPORT_BORDER}`,
        borderRadius: "12px",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div
        style={{
          fontFamily: REPORT_FONT_DISPLAY,
          fontSize: "16px",
          fontWeight: 700,
          color: REPORT_ORANGE_DEEP,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      {rows.map((r) => {
        const width = (Math.abs(r.value) / max) * 100;
        return (
          <div
            key={r.player}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "16px",
              margin: "0 -8px",
              padding: "5px 8px",
              borderRadius: "6px",
              background: r.isMe ? REPORT_ORANGE_TINT : "transparent",
            }}
          >
            {/* Orange marker on the featured player's row */}
            <span
              style={{
                width: "4px",
                height: "18px",
                borderRadius: "2px",
                background: r.isMe ? REPORT_ORANGE : "transparent",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                width: "110px",
                color: r.isMe ? REPORT_NAVY : REPORT_MUTED,
                fontWeight: r.isMe ? 700 : 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {r.player}
            </span>
            <div
              style={{
                flex: 1,
                height: "16px",
                background: REPORT_CARD_BG,
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  height: "100%",
                  background: r.isMe ? REPORT_NAVY : REPORT_NAVY_LIGHT,
                  borderRadius: "4px",
                  minWidth: "4px",
                }}
              />
            </div>
            <span
              style={{
                width: "70px",
                textAlign: "right",
                fontFamily: REPORT_FONT_DISPLAY,
                fontSize: "20px",
                fontWeight: 700,
                lineHeight: 1,
                color: r.isMe ? REPORT_NAVY : REPORT_MUTED,
              }}
            >
              {fmt(r.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TeamComparison({ data }: { data: ReportCardData }) {
  const me = data.cohort.find((c) => c.playerId === data.player.id);
  const primaryLabel = me?.primaryStatLabel ?? "Primary";
  const secondaryLabel = me?.secondaryStatLabel ?? "Secondary";

  const rowsBank = [...data.cohort]
    .sort((a, b) => b.bankBalance - a.bankBalance)
    .map<ChartRow>((c) => ({
      player: c.name,
      value: c.bankBalance,
      isMe: c.playerId === data.player.id,
    }));
  const rowsPrimary = [...data.cohort]
    .sort((a, b) => b.primaryStat - a.primaryStat)
    .map<ChartRow>((c) => ({
      player: c.name,
      value: c.primaryStat,
      isMe: c.playerId === data.player.id,
    }));
  const rowsErrors = [...data.cohort]
    .sort((a, b) => a.errorsPerMatch - b.errorsPerMatch)
    .map<ChartRow>((c) => ({
      player: c.name,
      value: c.errorsPerMatch,
      isMe: c.playerId === data.player.id,
    }));
  const rowsSecondary = [...data.cohort]
    .sort((a, b) => b.secondaryStat - a.secondaryStat)
    .map<ChartRow>((c) => ({
      player: c.name,
      value: c.secondaryStat,
      isMe: c.playerId === data.player.id,
    }));

  return (
    <ReportShell position={data.player.position} neutral={!data.usesPositions} cardKey="06 TEAM COMPARISON">
      <PlayerHeader
        name={data.player.name}
        number={data.player.number}
        position={data.player.position}
        scopeLabel={data.scopeLabel}
        teamName={data.team.name}
        secondaryPosition={data.player.secondaryPosition}
        neutral={!data.usesPositions}
      />

      <div
        style={{
          marginTop: "28px",
          fontSize: "18px",
          color: REPORT_BODY,
          lineHeight: 1.4,
        }}
      >
        {data.usesPositions
          ? "Compared only with teammates at the same position - a fair comparison is the only kind that matters."
          : "Compared with every teammate - on this team everyone rotates through every position, so everyone is measured on the same all-around numbers."}
      </div>

      <div
        style={{
          marginTop: "20px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          flex: 1,
        }}
      >
        {chart(rowsBank, "Bank Account", (n) => (n > 0 ? `+${n}` : `${n}`))}
        {chart(rowsPrimary, primaryLabel, (n) => fmtNum(n, 2))}
        {chart(rowsErrors, "Errors / Match (lower is better)", (n) => fmtNum(n, 1))}
        {chart(rowsSecondary, secondaryLabel, (n) => fmtNum(n, 2))}
      </div>
    </ReportShell>
  );
}
