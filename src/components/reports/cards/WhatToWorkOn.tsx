import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import { REPORT_CARD_BG, REPORT_MUTED, type ReportCardData } from "./types";

export function WhatToWorkOn({ data }: { data: ReportCardData }) {
  return (
    <ReportShell position={data.player.position} cardKey="03 WHAT TO WORK ON">
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
          fontSize: "26px",
          fontWeight: 600,
          color: "#e2e8f0",
        }}
      >
        {data.player.name}, here&apos;s what to focus on next:
      </div>

      <div
        style={{
          marginTop: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          flex: 1,
        }}
      >
        {data.improvementAreas.map((area, i) => (
          <div
            key={i}
            style={{
              background: REPORT_CARD_BG,
              border: "1px solid #1f2937",
              borderRadius: "20px",
              padding: "26px 28px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "0",
                left: "0",
                bottom: "0",
                width: "6px",
                background: "#22d3ee",
              }}
            />
            <div style={{ display: "flex", alignItems: "baseline", gap: "20px" }}>
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "42px",
                  fontWeight: 800,
                  color: "#22d3ee",
                  minWidth: "60px",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    color: "#f8fafc",
                  }}
                >
                  {area.metric}
                </div>
                {(area.current !== "—" || area.target !== "—") && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "16px",
                      color: REPORT_MUTED,
                    }}
                  >
                    current{" "}
                    <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                      {area.current}
                    </span>
                    {"  ·  "}
                    target{" "}
                    <span style={{ color: "#34d399", fontWeight: 700 }}>
                      {area.target}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    marginTop: "12px",
                    fontSize: "18px",
                    color: "#cbd5e1",
                    lineHeight: 1.45,
                  }}
                >
                  {area.detail}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "20px",
          fontSize: "16px",
          color: REPORT_MUTED,
          textAlign: "center",
        }}
      >
        Specific, repeatable drills. Work one at a time for a week each.
      </div>
    </ReportShell>
  );
}
