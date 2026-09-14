import { BREAKDOWN_LABELS } from "@/engine/bank-account";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import {
  REPORT_BG,
  REPORT_BODY,
  REPORT_BORDER,
  REPORT_FONT_DISPLAY,
  REPORT_GREEN,
  REPORT_MUTED,
  REPORT_RED,
  REPORT_TEXT,
  type ReportCardData,
} from "./types";

// Sequential ramps, darkest first so the biggest slice reads strongest.
// The engine has six deposit categories and five withdrawal categories, so
// nothing wraps.
const DEPOSIT_PALETTE = [
  "#17633c",
  "#1a7f4a",
  "#1b9757",
  "#25e380",
  "#6eecab",
  "#a5f3ca",
];
const WITHDRAWAL_PALETTE = [
  "#991b1b",
  "#b91c1c",
  "#dc2626",
  "#ef4444",
  "#fca5a5",
];

const DONUT_SIZE = 260;
const DONUT_THICKNESS = 44;

function polar(r: number, angle: number): [number, number] {
  const c = DONUT_SIZE / 2;
  return [
    Number((c + r * Math.cos(angle)).toFixed(2)),
    Number((c + r * Math.sin(angle)).toFixed(2)),
  ];
}

// Donut drawn as solid SVG ring slices - html-to-image rasterises inline SVG
// reliably, and a white hairline between slices keeps neighbours readable.
function Donut({ values, palette }: { values: number[]; palette: string[] }) {
  const total = values.reduce((s, v) => s + v, 0);
  const c = DONUT_SIZE / 2;
  const rOuter = c - 1;
  const rInner = rOuter - DONUT_THICKNESS;
  const rMid = (rOuter + rInner) / 2;

  if (total === 0) {
    return (
      <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
        <circle
          cx={c}
          cy={c}
          r={rMid}
          fill="none"
          stroke={REPORT_BORDER}
          strokeWidth={DONUT_THICKNESS}
        />
      </svg>
    );
  }

  let acc = 0;
  const slices = values.map((v, i) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += v;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const color = palette[i % palette.length];
    if (v <= 0) return null;
    if (v === total) {
      // A single slice is a full ring - an arc from a point to itself draws nothing.
      return (
        <circle
          key={i}
          cx={c}
          cy={c}
          r={rMid}
          fill="none"
          stroke={color}
          strokeWidth={DONUT_THICKNESS}
        />
      );
    }
    const large = end - start > Math.PI ? 1 : 0;
    const [x0, y0] = polar(rOuter, start);
    const [x1, y1] = polar(rOuter, end);
    const [xi1, yi1] = polar(rInner, end);
    const [xi0, yi0] = polar(rInner, start);
    const d = [
      `M ${x0} ${y0}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}`,
      `L ${xi1} ${yi1}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${xi0} ${yi0}`,
      "Z",
    ].join(" ");
    return (
      <path
        key={i}
        d={d}
        fill={color}
        stroke={REPORT_BG}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    );
  });

  return (
    <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
      {slices}
    </svg>
  );
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
          headerColor={REPORT_GREEN}
        />
        <PieColumn
          title="Where Withdrawals Come From"
          total={withdrawalTotal}
          slices={withdrawals}
          values={withdrawalValues}
          palette={WITHDRAWAL_PALETTE}
          headerColor={REPORT_RED}
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
        background: REPORT_BG,
        border: `1px solid ${REPORT_BORDER}`,
        borderRadius: "12px",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: REPORT_FONT_DISPLAY,
          fontSize: "18px",
          fontWeight: 700,
          color: headerColor,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
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
            width: `${DONUT_SIZE}px`,
            height: `${DONUT_SIZE}px`,
          }}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            <Donut values={values} palette={palette} />
          </div>
          <div
            style={{
              position: "absolute",
              inset: `${DONUT_THICKNESS}px`,
              borderRadius: "50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: REPORT_FONT_DISPLAY,
                fontSize: "52px",
                fontWeight: 800,
                color: REPORT_TEXT,
                lineHeight: 1,
              }}
            >
              {total}
            </span>
            <span
              style={{
                marginTop: "4px",
                fontFamily: REPORT_FONT_DISPLAY,
                fontSize: "13px",
                fontWeight: 700,
                color: REPORT_MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
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
                  padding: "7px 0",
                  borderBottom:
                    i < slices.length - 1 ? `1px solid ${REPORT_BORDER}` : "none",
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
                <span style={{ flex: 1, color: REPORT_BODY }}>
                  {BREAKDOWN_LABELS[k] ?? k}
                </span>
                <span
                  style={{
                    fontFamily: REPORT_FONT_DISPLAY,
                    fontSize: "20px",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: REPORT_TEXT,
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
