import { BREAKDOWN_LABELS } from "@/engine/bank-account";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import { REPORT_CARD_BG, REPORT_MUTED, type ReportCardData } from "./types";

const DEPOSIT_PALETTE = [
  "#34d399",
  "#22d3ee",
  "#a78bfa",
  "#10b981",
  "#0ea5e9",
  "#6366f1",
];
const WITHDRAWAL_PALETTE = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#ef4444",
  "#f97316",
  "#eab308",
];

// We render a donut chart using a single conic-gradient — avoids depending on
// Recharts inside the html-to-image capture, which can be flaky.
function donutGradient(values: number[], palette: string[]): string {
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return "conic-gradient(#1f2937 0deg 360deg)";
  let acc = 0;
  const stops: string[] = [];
  values.forEach((v, i) => {
    const start = (acc / total) * 360;
    acc += v;
    const end = (acc / total) * 360;
    stops.push(`${palette[i % palette.length]} ${start}deg ${end}deg`);
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function BreakdownPie({ data }: { data: ReportCardData }) {
  const ba = data.bankAccount;
  const deposits = Object.entries(ba.depositBreakdown)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const withdrawals = Object.entries(ba.withdrawalBreakdown)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const depositValues = deposits.map(([, v]) => v);
  const withdrawalValues = withdrawals.map(([, v]) => v);
  const depositTotal = depositValues.reduce((s, v) => s + v, 0);
  const withdrawalTotal = withdrawalValues.reduce((s, v) => s + v, 0);

  return (
    <ReportShell position={data.player.position} cardKey="05 BREAKDOWN">
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
          marginTop: "32px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          flex: 1,
        }}
      >
        <PieColumn
          title="Where Deposits Come From"
          total={depositTotal}
          slices={deposits}
          values={depositValues}
          palette={DEPOSIT_PALETTE}
          headerColor="#34d399"
        />
        <PieColumn
          title="Where Withdrawals Come From"
          total={withdrawalTotal}
          slices={withdrawals}
          values={withdrawalValues}
          palette={WITHDRAWAL_PALETTE}
          headerColor="#f87171"
        />
      </div>
    </ReportShell>
  );
}

function PieColumn({
  title,
  total,
  slices,
  values,
  palette,
  headerColor,
}: {
  title: string;
  total: number;
  slices: [string, number][];
  values: number[];
  palette: string[];
  headerColor: string;
}) {
  return (
    <div
      style={{
        background: REPORT_CARD_BG,
        border: "1px solid #1f2937",
        borderRadius: "20px",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: headerColor,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: "20px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "260px",
            height: "260px",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                slices.length === 0
                  ? "#1f2937"
                  : donutGradient(values, palette),
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "40px",
              borderRadius: "50%",
              background: REPORT_CARD_BG,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "44px",
                fontWeight: 800,
                color: "#f1f5f9",
                lineHeight: 1,
              }}
            >
              {total}
            </span>
            <span
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: REPORT_MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              total
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {slices.length === 0 ? (
          <div style={{ color: REPORT_MUTED, fontSize: "16px" }}>
            None recorded.
          </div>
        ) : (
          slices.map(([k, v], i) => {
            const pct = total > 0 ? (v / total) * 100 : 0;
            return (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "16px",
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    background: palette[i % palette.length],
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, color: "#e2e8f0" }}>
                  {BREAKDOWN_LABELS[k] ?? k}
                </span>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    color: "#f1f5f9",
                    fontWeight: 700,
                  }}
                >
                  {v}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: REPORT_MUTED,
                    width: "44px",
                    textAlign: "right",
                  }}
                >
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
