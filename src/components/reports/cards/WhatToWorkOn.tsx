import { Play } from "lucide-react";
import { ReportShell } from "../shared/ReportShell";
import { PlayerHeader } from "../shared/PlayerHeader";
import { youtubeSearchUrl } from "@/lib/youtube";
import {
  REPORT_BG,
  REPORT_BODY,
  REPORT_BORDER,
  REPORT_FONT_DISPLAY,
  REPORT_GREEN,
  REPORT_MUTED,
  REPORT_NAVY,
  REPORT_ACCENT,
  REPORT_ACCENT_DEEP,
  REPORT_TEXT,
  type ReportCardData,
} from "./types";

export function WhatToWorkOn({ data }: { data: ReportCardData }) {
  return (
    <ReportShell position={data.player.position} neutral={!data.usesPositions} cardKey="03 WHAT TO WORK ON">
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
          marginTop: "32px",
          fontFamily: REPORT_FONT_DISPLAY,
          fontSize: "34px",
          fontWeight: 700,
          lineHeight: 1.1,
          color: REPORT_TEXT,
        }}
      >
        {data.player.name}, here&apos;s what to focus on next:
      </div>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          flex: 1,
        }}
      >
        {data.improvementAreas.map((area, i) => (
          <div
            key={i}
            style={{
              background: REPORT_BG,
              border: `1px solid ${REPORT_BORDER}`,
              borderRadius: "12px",
              padding: "24px 28px 24px 30px",
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
                background: REPORT_ACCENT,
              }}
            />
            <div style={{ display: "flex", alignItems: "baseline", gap: "20px" }}>
              <span
                style={{
                  fontFamily: REPORT_FONT_DISPLAY,
                  fontSize: "46px",
                  fontWeight: 800,
                  lineHeight: 1,
                  color: REPORT_ACCENT_DEEP,
                  minWidth: "60px",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: REPORT_FONT_DISPLAY,
                    fontSize: "32px",
                    fontWeight: 700,
                    lineHeight: 1.05,
                    color: REPORT_TEXT,
                  }}
                >
                  {area.metric}
                </div>
                {(area.current !== "-" || area.target !== "-") && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "16px",
                      color: REPORT_MUTED,
                    }}
                  >
                    current{" "}
                    <span style={{ color: REPORT_NAVY, fontWeight: 700 }}>
                      {area.current}
                    </span>
                    {"  ·  "}
                    target{" "}
                    <span style={{ color: REPORT_GREEN, fontWeight: 700 }}>
                      {area.target}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    marginTop: "12px",
                    fontSize: "18px",
                    color: REPORT_BODY,
                    lineHeight: 1.45,
                  }}
                >
                  {area.detail}
                </div>
                {area.youtubeQuery && (
                  <a
                    href={youtubeSearchUrl(area.youtubeQuery)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "16px",
                      fontWeight: 600,
                      color: REPORT_ACCENT_DEEP,
                      textDecoration: "none",
                    }}
                  >
                    <Play size={16} strokeWidth={2} />
                    Watch drill videos: &ldquo;volleyball {area.youtubeQuery}&rdquo;
                  </a>
                )}
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
