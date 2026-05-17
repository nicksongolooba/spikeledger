import { fmtNum } from "@/engine/derived-stats";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import {
  REPORT_CARD_BG,
  REPORT_MUTED,
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
        background: REPORT_CARD_BG,
        border: "1px solid #1f2937",
        borderRadius: "16px",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "#cbd5e1",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
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
            }}
          >
            <span
              style={{
                width: "110px",
                color: r.isMe ? "#22d3ee" : "#94a3b8",
                fontWeight: r.isMe ? 700 : 500,
              }}
            >
              {r.player}
            </span>
            <div
              style={{
                flex: 1,
                height: "16px",
                background: "#0f172a",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  height: "100%",
                  background: r.isMe ? "#22d3ee" : "#475569",
                  borderRadius: "8px",
                  minWidth: "4px",
                }}
              />
            </div>
            <span
              style={{
                width: "70px",
                textAlign: "right",
                fontFamily: '"JetBrains Mono", monospace',
                color: r.isMe ? "#22d3ee" : "#cbd5e1",
                fontWeight: 700,
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
    <ReportShell position={data.player.position} cardKey="06 TEAM COMPARISON">
      <PlayerHeader
        name={data.player.name}
        number={data.player.number}
        position={data.player.position}
        scopeLabel={data.scopeLabel}
        teamName={data.team.name}
        secondaryPosition={data.player.secondaryPosition}
      />

      <div
        style={{
          marginTop: "28px",
          fontSize: "18px",
          color: REPORT_MUTED,
          lineHeight: 1.4,
        }}
      >
        Compared only with teammates at the same position — a fair comparison
        is the only kind that matters.
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
