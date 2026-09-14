import { POSITION_GROUP_MAP } from "@/engine/bank-account";
import { fmtNum, fmtPct } from "@/engine/derived-stats";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import {
  REPORT_BG,
  REPORT_BODY,
  REPORT_BORDER,
  REPORT_FONT_DISPLAY,
  REPORT_GREEN,
  REPORT_MUTED,
  REPORT_NAVY,
  REPORT_ORANGE_DEEP,
  REPORT_RED,
  type ReportCardData,
} from "./types";

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
  // No-positions teams: every section applies to every player.
  const group = data.usesPositions ? POSITION_GROUP_MAP[data.player.position] : null;
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
                group === "setter_middle" || group === null
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

function valueColor(emphasis: Row["emphasis"]) {
  if (emphasis === "good") return REPORT_GREEN;
  if (emphasis === "bad") return REPORT_RED;
  return REPORT_NAVY;
}

export function YourNumbers({ data }: { data: ReportCardData }) {
  const sections = sectionsFor(data);
  return (
    <ReportShell position={data.player.position} neutral={!data.usesPositions} cardKey="02 YOUR NUMBERS">
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
              background: REPORT_BG,
              border: `1px solid ${REPORT_BORDER}`,
              borderRadius: "12px",
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                fontFamily: REPORT_FONT_DISPLAY,
                fontSize: "17px",
                color: REPORT_ORANGE_DEEP,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontWeight: 700,
                marginBottom: "6px",
              }}
            >
              {section.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {section.rows.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "12px",
                    padding: "9px 0",
                    borderBottom:
                      i < section.rows.length - 1
                        ? `1px solid ${REPORT_BORDER}`
                        : "none",
                  }}
                >
                  <span style={{ fontSize: "17px", color: REPORT_BODY }}>
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
                        fontFamily: REPORT_FONT_DISPLAY,
                        fontSize: "30px",
                        fontWeight: 700,
                        lineHeight: 1,
                        color: valueColor(row.emphasis),
                      }}
                    >
                      {row.total}
                    </span>
                    {row.perMatch && (
                      <span style={{ fontSize: "14px", color: REPORT_MUTED }}>
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
