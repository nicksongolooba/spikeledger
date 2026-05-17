import { POSITION_GROUP_MAP, BREAKDOWN_LABELS } from "@/engine/bank-account";
import { fmtSigned } from "@/engine/derived-stats";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import {
  REPORT_CARD_BG,
  REPORT_DIM,
  REPORT_MUTED,
  type ReportCardData,
} from "./types";

const GROUP_LABEL = {
  hitter: "Hitter",
  setter_middle: "Setter / Middle",
  libero_ds: "Libero / DS",
} as const;

export function BankAccountCard({ data }: { data: ReportCardData }) {
  const ba = data.bankAccount;
  const group = POSITION_GROUP_MAP[data.player.position];

  // Build a horizontal bar that visually splits deposits (green) vs withdrawals (red).
  const total = Math.max(1, ba.deposits + ba.withdrawals);
  const depositPct = (ba.deposits / total) * 100;
  const withdrawalPct = (ba.withdrawals / total) * 100;

  return (
    <ReportShell position={data.player.position} cardKey="04 BANK ACCOUNT">
      <PlayerHeader
        name={data.player.name}
        number={data.player.number}
        position={data.player.position}
        scopeLabel={data.scopeLabel}
        teamName={data.team.name}
        secondaryPosition={data.player.secondaryPosition}
      />

      <div style={{ marginTop: "28px", display: "flex", alignItems: "center", gap: "32px" }}>
        <div>
          <div
            style={{
              fontSize: "16px",
              color: REPORT_MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
            }}
          >
            Net Balance
          </div>
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "96px",
              fontWeight: 800,
              color: ba.ratingColor,
              lineHeight: 1,
            }}
          >
            {fmtSigned(ba.balance)}
          </div>
          <div
            style={{
              marginTop: "8px",
              fontSize: "20px",
              fontWeight: 600,
              color: ba.ratingColor,
            }}
          >
            {ba.ratingLabel}
          </div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontSize: "16px",
            color: REPORT_MUTED,
            textAlign: "right",
          }}
        >
          Evaluated as
          <div
            style={{
              fontSize: "26px",
              fontWeight: 700,
              color: "#f1f5f9",
              marginTop: "4px",
            }}
          >
            {GROUP_LABEL[group]}
          </div>
        </div>
      </div>

      {/* Horizontal split bar */}
      <div style={{ marginTop: "28px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "16px",
            fontWeight: 700,
            color: REPORT_MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "8px",
          }}
        >
          <span style={{ color: "#34d399" }}>{ba.deposits} deposits</span>
          <span style={{ color: "#f87171" }}>{ba.withdrawals} withdrawals</span>
        </div>
        <div
          style={{
            height: "32px",
            background: "#0f172a",
            border: "1px solid #1f2937",
            borderRadius: "16px",
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div
            style={{
              width: `${depositPct}%`,
              background: "linear-gradient(90deg, #10b981, #34d399)",
              minWidth: ba.deposits > 0 ? "4px" : "0",
            }}
          />
          <div
            style={{
              width: `${withdrawalPct}%`,
              background: "linear-gradient(90deg, #f87171, #dc2626)",
              minWidth: ba.withdrawals > 0 ? "4px" : "0",
              marginLeft: "auto",
            }}
          />
        </div>
      </div>

      {/* Breakdown columns */}
      <div
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          flex: 1,
        }}
      >
        <BreakdownColumn
          title="Deposits"
          color="#34d399"
          items={ba.depositBreakdown}
        />
        <BreakdownColumn
          title="Withdrawals"
          color="#f87171"
          items={ba.withdrawalBreakdown}
        />
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "16px 20px",
          background: REPORT_CARD_BG,
          border: "1px solid #1f2937",
          borderRadius: "14px",
          fontSize: "15px",
          color: REPORT_DIM,
          lineHeight: 1.55,
        }}
      >
        <span style={{ color: "#22d3ee", fontWeight: 700 }}>
          How the Bank Account works:
        </span>{" "}
        Deposits are actions that help the team. Withdrawals are actions that
        hurt it. Each position is evaluated on what it&apos;s supposed to do —
        a libero&apos;s good pass counts as a deposit because passing is the
        job; a hitter&apos;s good pass is the baseline.
      </div>
    </ReportShell>
  );
}

function BreakdownColumn({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: Record<string, number>;
}) {
  const rows = Object.entries(items).filter(([, v]) => v > 0);
  return (
    <div
      style={{
        background: REPORT_CARD_BG,
        border: "1px solid #1f2937",
        borderRadius: "16px",
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 700,
          color,
          marginBottom: "12px",
        }}
      >
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ color: REPORT_MUTED, fontSize: "16px" }}>None.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {rows
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "17px",
                }}
              >
                <span style={{ color: "#cbd5e1" }}>
                  {BREAKDOWN_LABELS[k] ?? k}
                </span>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 700,
                    color: "#f1f5f9",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
