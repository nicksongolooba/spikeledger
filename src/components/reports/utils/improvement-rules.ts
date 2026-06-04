// Rule-based "What To Work On" - picks the three most relevant focus areas
// for a player, taking position into account so a libero isn't told to work on
// hitting efficiency, and a middle is never told to work on assists.
//
// Position groups here are the FOUR-way split (hitter / middle / setter /
// libero) from lib/positions, NOT the Bank Account's three-way grouping that
// lumps setters and middles together. Coaching advice for a setter (assists,
// distribution) is wrong for a middle (blocking, quick attacks), so the two
// must stay separate.

import type { Position } from "@prisma/client";
import { POSITION_GROUP, type PositionGroup } from "@/lib/positions";
import type { DerivedStats } from "@/engine/derived-stats";

export interface ImprovementArea {
  metric: string;        // "Serve receive"
  current: string;       // "1.42"
  target: string;        // "2.0+"
  detail: string;        // one-line drill suggestion
  severity: number;      // 0..1, used for ranking
  youtubeQuery?: string; // drill search terms (no URL); link built in code
}

interface Rule {
  // Only consider this rule for these position groups
  appliesTo: PositionGroup[];
  // Returns null if the rule doesn't fire; otherwise returns an area
  // with a severity score (higher = more urgent).
  evaluate: (s: DerivedStats, name: string) => ImprovementArea | null;
}

const RULES: Rule[] = [
  // --- Passing (Libero / hitter only - setters and middles don't pass) ---
  {
    appliesTo: ["libero"],
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
        youtubeQuery: "serve receive passing drill",
        severity: severity * 1.2, // weighted higher - this is the libero's core job
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
        youtubeQuery: "serve receive footwork drill",
        severity: (1.8 - s.srAverage) / 1.8,
      };
    },
  },

  // --- Attacking: hitters work shot selection ---
  {
    appliesTo: ["hitter"],
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
        youtubeQuery: "hitting tip and roll drill",
        severity: Math.max(0, (0.2 - s.hittingEfficiency) / 0.2),
      };
    },
  },

  // --- Attacking: middles work quick-attack efficiency (never set) ---
  {
    appliesTo: ["middle"],
    evaluate: (s) => {
      if (s.totalKills + s.totalAttackErrors < 5) return null;
      if (s.hittingEfficiency >= 0.15) return null;
      return {
        metric: "Quick attack efficiency",
        current: `${(s.hittingEfficiency * 100).toFixed(0)}%`,
        target: "20%+",
        detail:
          "Quick-set timing: approach early, attack at the top of a fast 1-ball, finish over the seam. 15 swings/practice.",
        youtubeQuery: "middle quick attack hitting drill",
        severity: Math.max(0, (0.2 - s.hittingEfficiency) / 0.2),
      };
    },
  },

  // --- Serving (everyone who serves) ---
  {
    appliesTo: ["hitter", "middle", "setter", "libero"],
    evaluate: (s) => {
      if (s.totalServeErrors + s.totalAces < 3) return null;
      if (s.serveErrorPercentage <= 0.3) return null;
      return {
        metric: "Serve consistency",
        current: `${(s.serveErrorPercentage * 100).toFixed(0)}% errors`,
        target: "<20%",
        detail:
          "Target serving: 20 serves per practice, 5 to each zone. Slow down toss when nerves spike late in sets.",
        youtubeQuery: "serving accuracy target drill",
        severity: (s.serveErrorPercentage - 0.2) * 1.5,
      };
    },
  },

  // --- Ball control (everyone) ---
  {
    appliesTo: ["hitter", "middle", "setter", "libero"],
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
        youtubeQuery: "pepper ball control drill",
        severity: Math.min(1, (epm - 2) / 5),
      };
    },
  },

  // --- Blocking (middles + front-row setters) ---
  {
    appliesTo: ["middle", "setter"],
    evaluate: (s) => {
      if (s.matchesPlayed < 2) return null;
      if (s.blocksPerMatch >= 1.0) return null;
      return {
        metric: "Blocking presence",
        current: s.blocksPerMatch.toFixed(1) + "/match",
        target: "1.5+",
        detail:
          "Read-and-react footwork: watch setter's shoulders, commit to outside-shoot on quick sets. Mirror drills 10 min/practice.",
        youtubeQuery: "blocking footwork mirror drill",
        severity: Math.max(0, (1.5 - s.blocksPerMatch) / 1.5),
      };
    },
  },

  // --- Distribution (SETTERS ONLY - middles never set) ---
  {
    appliesTo: ["setter"],
    evaluate: (s) => {
      if (s.matchesPlayed < 2) return null;
      if (s.assistsPerMatch >= 6) return null;
      return {
        metric: "Distribution",
        current: s.assistsPerMatch.toFixed(1) + " assists/match",
        target: "8+",
        detail:
          "Get to more second balls - even off bad passes. Footwork drill: pass-set-pass triangles 5 min/practice.",
        youtubeQuery: "setter footwork drill",
        severity: Math.max(0, (8 - s.assistsPerMatch) / 8) * 0.6,
      };
    },
  },
];

// "Maintain" callout when a player has no obvious weaknesses - we still want
// to fill the slot with something specific and encouraging. Keyed by the
// four-way position group so setters and middles get distinct advice.
const MAINTAIN_AREAS: Record<PositionGroup, ImprovementArea[]> = {
  hitter: [
    {
      metric: "Stay aggressive late",
      current: "-",
      target: "-",
      detail:
        "Your numbers are strong. Focus on closing sets: keep swinging at 20+ even when tired.",
      severity: 0,
    },
  ],
  middle: [
    {
      metric: "Own transition attacking",
      current: "-",
      target: "-",
      detail:
        "Strong base. Get off the net fast after blocking and beat the setter to the quick - transition kills win the middle battle.",
      youtubeQuery: "middle transition footwork drill",
      severity: 0,
    },
  ],
  setter: [
    {
      metric: "Mix up sets",
      current: "-",
      target: "-",
      detail:
        "Strong base. Add a low quick or back-row attack once per rotation to keep blocks honest.",
      youtubeQuery: "setter decision making drill",
      severity: 0,
    },
  ],
  libero: [
    {
      metric: "Lead from the back",
      current: "-",
      target: "-",
      detail:
        "Numbers are excellent. Talk more - call seams and tips early so blockers know what's coming.",
      severity: 0,
    },
  ],
};

export function computeImprovementAreas(
  stats: DerivedStats,
  position: Position,
  playerName: string,
): ImprovementArea[] {
  const group = POSITION_GROUP[position];
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
