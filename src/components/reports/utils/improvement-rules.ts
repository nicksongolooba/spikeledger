// Rule-based "What To Work On" — picks the three most relevant focus areas
// for a player, taking position into account so a libero isn't told to work on
// hitting efficiency.
//
// Phase 5 (Gemma) will replace this with real LLM-generated coaching insights.
// Until then, these rules keep the report card useful out of the box.

import type { Position } from "@prisma/client";
import { POSITION_GROUP_MAP } from "@/engine/bank-account";
import type { DerivedStats } from "@/engine/derived-stats";

export interface ImprovementArea {
  metric: string;        // "Serve receive"
  current: string;       // "1.42"
  target: string;        // "2.0+"
  detail: string;        // one-line drill suggestion
  severity: number;      // 0..1, used for ranking
}

interface Rule {
  // Only consider this rule for these position groups
  appliesTo: ("hitter" | "setter_middle" | "libero_ds")[];
  // Returns null if the rule doesn't fire; otherwise returns an area
  // with a severity score (higher = more urgent).
  evaluate: (s: DerivedStats, name: string) => ImprovementArea | null;
}

const RULES: Rule[] = [
  // --- Passing (Libero/hitter) ---
  {
    appliesTo: ["libero_ds"],
    evaluate: (s) => {
      if (s.srTotal < 5) return null; // not enough data
      if (s.srAverage >= 2.0) return null;
      const severity = Math.max(0, (2.0 - s.srAverage) / 2.0);
      return {
        metric: "Serve receive",
        current: s.srAverage.toFixed(2),
        target: "2.0+",
        detail:
          "Wall-pass repetitions, 10 min/practice. Focus on platform angle and shoulder alignment on hard serves.",
        severity: severity * 1.2, // weighted higher — this is the libero's core job
      };
    },
  },
  {
    appliesTo: ["hitter"],
    evaluate: (s) => {
      if (s.srTotal < 5) return null;
      if (s.srAverage >= 1.8) return null;
      return {
        metric: "Serve receive",
        current: s.srAverage.toFixed(2),
        target: "1.8+",
        detail:
          "Movement drill: split-step on contact, square hips to target. 5 min before every practice.",
        severity: (1.8 - s.srAverage) / 1.8,
      };
    },
  },

  // --- Attacking (Hitter / Middle) ---
  {
    appliesTo: ["hitter", "setter_middle"],
    evaluate: (s) => {
      // Only relevant once you've put up enough swings.
      if (s.totalKills + s.totalAttackErrors < 5) return null;
      if (s.hittingEfficiency >= 0.15) return null;
      return {
        metric: "Shot selection",
        current: `${(s.hittingEfficiency * 100).toFixed(0)}%`,
        target: "20%+",
        detail:
          "Controlled hitting vs block: tip or roll when blocked, swing only when seam is open. 15 reps/practice.",
        severity: Math.max(0, (0.2 - s.hittingEfficiency) / 0.2),
      };
    },
  },

  // --- Serving (everyone who serves) ---
  {
    appliesTo: ["hitter", "setter_middle", "libero_ds"],
    evaluate: (s) => {
      if (s.totalServeErrors + s.totalAces < 3) return null;
      if (s.serveErrorPercentage <= 0.3) return null;
      return {
        metric: "Serve consistency",
        current: `${(s.serveErrorPercentage * 100).toFixed(0)}% errors`,
        target: "<20%",
        detail:
          "Target serving: 20 serves per practice, 5 to each zone. Slow down toss when nerves spike late in sets.",
        severity: (s.serveErrorPercentage - 0.2) * 1.5,
      };
    },
  },

  // --- Ball control (everyone) ---
  {
    appliesTo: ["hitter", "setter_middle", "libero_ds"],
    evaluate: (s) => {
      if (s.matchesPlayed === 0) return null;
      const epm = s.errorsPerMatch;
      if (epm <= 3) return null;
      return {
        metric: "Ball control",
        current: `${epm.toFixed(1)} errors/match`,
        target: "<2",
        detail:
          "Pepper drills + controlled passing. Slow tempo, prioritize accuracy over power. 8 minutes/practice.",
        severity: Math.min(1, (epm - 2) / 5),
      };
    },
  },

  // --- Blocking (Middle specifically) ---
  {
    appliesTo: ["setter_middle"],
    evaluate: (s) => {
      if (s.matchesPlayed < 2) return null;
      if (s.blocksPerMatch >= 1.0) return null;
      return {
        metric: "Blocking presence",
        current: s.blocksPerMatch.toFixed(1) + "/match",
        target: "1.5+",
        detail:
          "Read-and-react footwork: watch setter's shoulders, commit to outside-shoot on quick sets. Mirror drills 10 min/practice.",
        severity: Math.max(0, (1.5 - s.blocksPerMatch) / 1.5),
      };
    },
  },

  // --- Setting volume (Setter) ---
  {
    appliesTo: ["setter_middle"],
    evaluate: (s) => {
      if (s.matchesPlayed < 2) return null;
      if (s.assistsPerMatch >= 6) return null;
      return {
        metric: "Distribution",
        current: s.assistsPerMatch.toFixed(1) + " assists/match",
        target: "8+",
        detail:
          "Get to more second balls — even off bad passes. Footwork drill: pass-set-pass triangles 5 min/practice.",
        severity: Math.max(0, (8 - s.assistsPerMatch) / 8) * 0.6,
      };
    },
  },
];

// "Maintain" callout when a player has no obvious weaknesses — we still want
// to fill the slot with something specific and encouraging.
const MAINTAIN_AREAS: Record<
  "hitter" | "setter_middle" | "libero_ds",
  ImprovementArea[]
> = {
  hitter: [
    {
      metric: "Stay aggressive late",
      current: "—",
      target: "—",
      detail:
        "Your numbers are strong. Focus on closing sets: keep swinging at 20+ even when tired.",
      severity: 0,
    },
  ],
  setter_middle: [
    {
      metric: "Mix up sets",
      current: "—",
      target: "—",
      detail:
        "Strong base. Add a low quick or back-row attack once per rotation to keep blocks honest.",
      severity: 0,
    },
  ],
  libero_ds: [
    {
      metric: "Lead from the back",
      current: "—",
      target: "—",
      detail:
        "Numbers are excellent. Talk more — call seams and tips early so blockers know what's coming.",
      severity: 0,
    },
  ],
};

export function computeImprovementAreas(
  stats: DerivedStats,
  position: Position,
  playerName: string,
): ImprovementArea[] {
  const group = POSITION_GROUP_MAP[position];
  const areas: ImprovementArea[] = [];
  for (const rule of RULES) {
    if (!rule.appliesTo.includes(group)) continue;
    const result = rule.evaluate(stats, playerName);
    if (result) areas.push(result);
  }
  areas.sort((a, b) => b.severity - a.severity);
  const top = areas.slice(0, 3);
  if (top.length < 3) {
    const fillers = MAINTAIN_AREAS[group];
    for (const f of fillers) {
      if (top.length >= 3) break;
      top.push(f);
    }
  }
  return top;
}
