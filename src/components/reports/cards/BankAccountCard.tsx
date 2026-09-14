import { BREAKDOWN_LABELS } from "@/engine/bank-account";
import { POSITION_LABELS } from "@/lib/positions";
import { fmtSigned } from "@/engine/derived-stats";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import {
  REPORT_BG,
  REPORT_BODY,
  REPORT_BORDER,
  REPORT_CARD_BG,
  REPORT_FONT_DISPLAY,
  REPORT_GREEN,
  REPORT_MUTED,
  REPORT_NAVY,
  REPORT_ACCENT_DEEP,
  REPORT_RED,
  REPORT_TEXT,
  type ReportCardData,
} from "./types";

export function BankAccountCard({ data }: { data: ReportCardData }) {
  const ba = data.bankAccount;

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
              fontFamily: REPORT_FONT_DISPLAY,
              fontSize: "16px",
              color: REPORT_ACCENT_DEEP,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 700,
            }}
          >
            Net Balance
          </div>
          <div
            style={{
              fontFamily: REPORT_FONT_DISPLAY,
              fontSize: "112px",
              fontWeight: 800,
              color: ba.ratingColor,
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
              marginTop: "6px",
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
              fontFamily: REPORT_FONT_DISPLAY,
              fontSize: "32px",
              fontWeight: 700,
              lineHeight: 1.1,
              color: REPORT_NAVY,
              marginTop: "4px",
            }}
          >
            {POSITION_LABELS[data.player.position]}
          </div>
        </div>
      </div>

      {/* Horizontal split bar */}
      <div style={{ marginTop: "28px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: REPORT_FONT_DISPLAY,
            fontSize: "17px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "8px",
          }}
        >
          <span style={{ color: REPORT_GREEN }}>{ba.deposits} deposits</span>
          <span style={{ color: REPORT_RED }}>{ba.withdrawals} withdrawals</span>
        </div>
        <div
          style={{
            height: "32px",
            background: REPORT_CARD_BG,
            border: `1px solid ${REPORT_BORDER}`,
            borderRadius: "6px",
            overflow: "hidden",
            display: "flex",
            gap: "3px",
          }}
        >
          <div
            style={{
              width: `${depositPct}%`,
              background: REPORT_GREEN,
              minWidth: ba.deposits > 0 ? "4px" : "0",
            }}
          />
          <div
            style={{
              width: `${withdrawalPct}%`,
              background: REPORT_RED,
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
          color={REPORT_GREEN}
          items={ba.depositBreakdown}
        />
        <BreakdownColumn
          title="Withdrawals"
          color={REPORT_RED}
          items={ba.withdrawalBreakdown}
        />
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "16px 20px",
          background: REPORT_CARD_BG,
          border: `1px solid ${REPORT_BORDER}`,
          borderRadius: "12px",
          fontSize: "15px",
          color: REPORT_BODY,
          lineHeight: 1.55,
        }}
      >
        <span style={{ color: REPORT_NAVY, fontWeight: 700 }}>
          How the Bank Account works:
        </span>{" "}
        Deposits are actions that help the team. Withdrawals are actions that
        hurt it. Each position is evaluated on what it&apos;s supposed to do -
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
        background: REPORT_BG,
        border: `1px solid ${REPORT_BORDER}`,
        borderRadius: "12px",
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontFamily: REPORT_FONT_DISPLAY,
          fontSize: "17px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 700,
          color,
          marginBottom: "6px",
        }}
      >
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ color: REPORT_MUTED, fontSize: "16px", padding: "8px 0" }}>
          None.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows
            .sort((a, b) => b[1] - a[1])
            .map(([k, v], i, arr) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontSize: "17px",
                  padding: "8px 0",
                  borderBottom:
                    i < arr.length - 1 ? `1px solid ${REPORT_BORDER}` : "none",
                }}
              >
                <span style={{ color: REPORT_BODY }}>
                  {BREAKDOWN_LABELS[k] ?? k}
                </span>
                <span
                  style={{
                    fontFamily: REPORT_FONT_DISPLAY,
                    fontSize: "24px",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: REPORT_TEXT,
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
