import { POSITION_GROUP_MAP } from "@/engine/bank-account";
import { fmtNum, fmtPct } from "@/engine/derived-stats";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import { REPORT_CARD_BG, REPORT_MUTED, type ReportCardData } from "./types";

interface Row {
  label: string;
  total: string;
  perMatch: string;
  emphasis?: "good" | "bad";
}

interface Section {
  title: string;
  rows: Row[];
}

function sectionsFor(data: ReportCardData): Section[] {
  const s = data.stats;
  const group = POSITION_GROUP_MAP[data.player.position];
  const passing: Section | null =
    s.srTotal > 0
      ? {
          title: "Passing",
          rows: [
            {
              label: "SR Average",
              total: fmtNum(s.srAverage, 2),
              perMatch: s.srAverage >= 2 ? "target hit" : "target 2.0",
              emphasis: s.srAverage >= 2 ? "good" : undefined,
            },
            {
              label: "Perfect passes (SR 3)",
              total: `${Math.round(s.perfectPassPercentage * s.srTotal)}`,
              perMatch: fmtPct(s.perfectPassPercentage, 0),
            },
            { label: "Total passes", total: `${s.srTotal}`, perMatch: "" },
          ],
        }
      : null;
  const attacking: Section | null =
    group !== "libero_ds"
      ? {
          title: "Attacking",
          rows: [
            {
              label: "Kills",
              total: `${s.totalKills}`,
              perMatch: `${fmtNum(s.killsPerMatch, 1)}/match`,
              emphasis: s.killsPerMatch >= 3 ? "good" : undefined,
            },
            {
              label: "Attack errors",
              total: `${s.totalAttackErrors}`,
              perMatch: "",
              emphasis: s.totalAttackErrors >= 5 ? "bad" : undefined,
            },
            {
              label: "Hitting %",
              total:
                s.totalKills + s.totalAttackErrors > 0
                  ? fmtPct(s.hittingEfficiency, 1)
                  : "-",
              perMatch: "target 20%+",
              emphasis:
                s.hittingEfficiency >= 0.2
                  ? "good"
                  : s.hittingEfficiency < 0.1
                    ? "bad"
                    : undefined,
            },
          ],
        }
      : null;
  const serving: Section = {
    title: "Serving",
    rows: [
      {
        label: "Aces",
        total: `${s.totalAces}`,
        perMatch: `${fmtNum(s.acesPerMatch, 1)}/match`,
        emphasis: s.acesPerMatch >= 2 ? "good" : undefined,
      },
      {
        label: "Serve errors",
        total: `${s.totalServeErrors}`,
        perMatch: "",
        emphasis: s.serveErrorPercentage > 0.3 ? "bad" : undefined,
      },
    ],
  };
  const blocking: Section | null =
    group !== "libero_ds"
      ? {
          title: "Blocking & Setting",
          rows: [
            {
              label: "Blocks",
              total: `${s.totalBlocks}`,
              perMatch: `${fmtNum(s.blocksPerMatch, 1)}/match`,
              emphasis: s.blocksPerMatch >= 1.5 ? "good" : undefined,
            },
            {
              label: "Assists",
              total: `${s.totalAssists}`,
              perMatch:
                group === "setter_middle"
                  ? `${fmtNum(s.assistsPerMatch, 1)}/match`
                  : "",
            },
          ],
        }
      : null;
  const defense: Section = {
    title: "Defense & Errors",
    rows: [
      {
        label: "Digs",
        total: `${s.totalDigs}`,
        perMatch: `${fmtNum(s.digsPerMatch, 1)}/match`,
      },
      {
        label: "Total errors",
        total: `${s.totalErrors}`,
        perMatch: `${fmtNum(s.errorsPerMatch, 1)}/match`,
        emphasis: s.errorsPerMatch <= 2 ? "good" : s.errorsPerMatch >= 4 ? "bad" : undefined,
      },
    ],
  };

  return [passing, attacking, serving, blocking, defense].filter(
    (s): s is Section => s !== null,
  );
}

export function YourNumbers({ data }: { data: ReportCardData }) {
  const sections = sectionsFor(data);
  return (
    <ReportShell position={data.player.position} cardKey="02 YOUR NUMBERS">
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
          marginTop: "36px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          flex: 1,
        }}
      >
        {sections.map((section) => (
          <div
            key={section.title}
            style={{
              background: REPORT_CARD_BG,
              border: "1px solid #1b2742",
              borderRadius: "16px",
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                color: REPORT_MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "12px",
              }}
            >
              {section.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {section.rows.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "17px", color: "#b6c0d1" }}>
                    {row.label}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "26px",
                        fontWeight: 700,
                        color:
                          row.emphasis === "good"
                            ? "#34d399"
                            : row.emphasis === "bad"
                              ? "#f87171"
                              : "#f4f3ed",
                      }}
                    >
                      {row.total}
                    </span>
                    {row.perMatch && (
                      <span style={{ fontSize: "14px", color: "#5d6d8f" }}>
                        {row.perMatch}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ReportShell>
  );
}
