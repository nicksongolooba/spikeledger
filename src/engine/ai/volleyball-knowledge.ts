// Curated volleyball coaching knowledge base. Every drill here is a real,
// commonly-run drill in competitive club programs - the AI is instructed to
// recommend ONLY from this list so it can never invent a drill name. The
// benchmarks reflect realistic competitive club standards per age group
// (a "match" is calibrated to a typical youth best-of-3, ~2.5 sets).

import type { Position } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DrillCategory =
  | "passing"
  | "hitting"
  | "blocking"
  | "serving"
  | "setting"
  | "defense"
  | "team";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type AgeGroupMin = "12U" | "14U" | "16U" | "18U" | "adult";
export type BenchmarkAgeGroup = "14U" | "16U" | "18U" | "adult";

export interface Drill {
  name: string;
  category: DrillCategory;
  playersNeeded: number;
  durationMinutes: number;
  equipment: string[];
  skillFocus: string[];
  positionRelevance: Position[];
  difficulty: Difficulty;
  ageGroupMin: AgeGroupMin;
  description: string;
  coachingPoints: string[];
  youtubeQuery: string;
  variations: string[];
}

export interface StatTier {
  developing: number;
  solid: number;
  elite: number;
}

export interface StatBenchmarks {
  position: Position;
  ageGroup: BenchmarkAgeGroup;
  targets: {
    hittingEfficiency: StatTier;
    srAverage: StatTier;
    acesPerMatch: StatTier;
    blocksPerMatch: StatTier;
    assistsPerMatch: StatTier;
    digsPerMatch: StatTier;
    serveErrorRate: StatTier; // percent of serve attempts - LOWER is better
    errorsPerMatch: StatTier; // all errors combined - LOWER is better
  };
}

export interface PositionFramework {
  position: Position;
  eliteProfile: string;
  developmentPriorities: string[]; // top 5, in order
  commonMistakes: { "14U": string; "16U": string; "18U": string };
  bankAccountNotes: string;
  mentalGame: string;
}

export interface PracticePhase {
  phase: string;
  minutes: number;
  guidance: string; // how the AI should pick drills for this phase
}

export interface PracticePlanTemplate {
  name: string;
  whenToUse: string;
  phases: PracticePhase[];
}

// ---------------------------------------------------------------------------
// Drill database - 51 real drills
// ---------------------------------------------------------------------------

const ALL: Position[] = ["OH", "RS", "OPP", "MB", "S", "L", "DS", "UTIL"];
const PASSERS: Position[] = ["L", "DS", "OH", "UTIL"];
const HITTERS: Position[] = ["OH", "RS", "OPP", "MB", "UTIL"];
const PIN_HITTERS: Position[] = ["OH", "RS", "OPP", "UTIL"];
const FRONT_ROW: Position[] = ["OH", "RS", "OPP", "MB", "S"];
const BACK_ROW: Position[] = ["L", "DS", "OH", "S", "UTIL"];

export const DRILLS: Drill[] = [
  // ---------------- Passing / Serve Receive (10) ----------------
  {
    name: "Butterfly Drill",
    category: "passing",
    playersNeeded: 6,
    durationMinutes: 15,
    equipment: ["6+ balls", "net", "2 targets"],
    skillFocus: ["serve receive", "passing accuracy", "movement between roles"],
    positionRelevance: PASSERS,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Players rotate through serve, pass, and target on both sides of the net in a continuous figure-eight flow. The server serves cross-court, the passer passes to the target at the net, then everyone follows their ball to the next role.",
    coachingPoints: [
      "Passers call 'mine' early and beat the ball to the spot",
      "Platform finishes angled to target, not swinging at the ball",
      "Keep the flow continuous - no standing in line",
    ],
    youtubeQuery: "butterfly passing drill",
    variations: [
      "Harder: servers must hit zones 1 and 5 alternately",
      "Easier: start with down-ball tosses instead of serves",
    ],
  },
  {
    name: "Triangle Passing",
    category: "passing",
    playersNeeded: 3,
    durationMinutes: 10,
    equipment: ["1 ball per group"],
    skillFocus: ["platform control", "passing accuracy", "communication"],
    positionRelevance: PASSERS,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Three players form a triangle: one tosses or serves, one passes, one is the target. Rotate roles every 10 reps so everyone passes, serves, and targets.",
    coachingPoints: [
      "Feet to the ball first, then freeze the platform",
      "Pass with legs and angle, not arm swing",
    ],
    youtubeQuery: "triangle passing drill",
    variations: [
      "Harder: tosser becomes a real server from 9m",
      "Easier: shorten the distance and toss underhand",
    ],
  },
  {
    name: "Servers vs. Passers",
    category: "passing",
    playersNeeded: 8,
    durationMinutes: 20,
    equipment: ["cart of balls", "net"],
    skillFocus: ["serve receive under pressure", "serving accuracy", "competition"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Split into a serving team and a passing team and play to a score: every 3-point pass earns the passers a point, every ace or 0-pass earns the servers a point. First side to 15 wins, then switch groups.",
    coachingPoints: [
      "Grade every pass out loud (0-3) so athletes link reps to the SR stat",
      "Passers communicate seams before the serve, not after",
    ],
    youtubeQuery: "servers versus passers drill",
    variations: [
      "Harder: only zone-1 and zone-5 serves count",
      "Easier: servers serve from inside the court",
    ],
  },
  {
    name: "Shuttle Passing",
    category: "passing",
    playersNeeded: 6,
    durationMinutes: 10,
    equipment: ["1 ball per line"],
    skillFocus: ["passing on the move", "footwork", "conditioning"],
    positionRelevance: PASSERS,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Two lines face each other; the front player passes across and sprints to the back of the opposite line. The ball never stops moving and neither do the athletes.",
    coachingPoints: [
      "Stopped feet at contact even though the drill is moving",
      "Push the tempo - shuttle drills die when players jog",
    ],
    youtubeQuery: "shuttle passing drill",
    variations: [
      "Harder: require a left-right-pass footwork pattern before each contact",
      "Easier: allow a catch-and-toss reset after errant passes",
    ],
  },
  {
    name: "21 Points Passing",
    category: "passing",
    playersNeeded: 4,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["serve receive consistency", "pass grading", "accountability"],
    positionRelevance: PASSERS,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Each passer receives real serves and earns their pass grade as points: 3 for a perfect pass, 2, 1, or 0. First passer to 21 points wins. Mirrors exactly how SR average is scored in SpikeLedger.",
    coachingPoints: [
      "A safe 2-pass beats a risky 3 attempt that becomes a shank",
      "Reset posture between every serve - no drifting",
    ],
    youtubeQuery: "serve receive scoring drill",
    variations: [
      "Harder: a 0-pass subtracts 2 points",
      "Easier: play to 15 with tossed serves",
    ],
  },
  {
    name: "Free-Ball Wash",
    category: "passing",
    playersNeeded: 12,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["free-ball conversion", "transition offense", "communication"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Coach alternates free balls to each side; the receiving team must convert in-system. A side must win two rallies in a row ('big point') to rotate - one win gets 'washed' if they lose the next.",
    coachingPoints: [
      "Free balls are gifts - the standard is a perfect pass every time",
      "Call 'free' early and get the setter released to target",
    ],
    youtubeQuery: "free ball wash drill",
    variations: [
      "Harder: coach sends a down ball instead of a free ball on the second rally",
      "Easier: one rally win earns the rotation",
    ],
  },
  {
    name: "Short-Deep Serve Receive",
    category: "passing",
    playersNeeded: 6,
    durationMinutes: 15,
    equipment: ["cart of balls", "net", "cones"],
    skillFocus: ["range in serve receive", "reading serve depth", "communication"],
    positionRelevance: PASSERS,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Servers deliberately alternate short serves into zone 2/3/4 and deep serves to the endline. Passers must read depth early, communicate, and handle both without retreating late.",
    coachingPoints: [
      "First read is depth, not direction - call 'short' or 'deep' before the ball crosses the net",
      "On deep balls, drop step and beat the ball back - never backpedal at contact",
    ],
    youtubeQuery: "short deep serve receive drill",
    variations: [
      "Harder: passers start leaning wrong direction on coach's signal",
      "Easier: server announces short or deep before serving",
    ],
  },
  {
    name: "Three-Person Pepper",
    category: "passing",
    playersNeeded: 3,
    durationMinutes: 10,
    equipment: ["1 ball per group"],
    skillFocus: ["ball control", "pass-set-hit rhythm", "controlled attacking"],
    positionRelevance: ALL,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Dig-set-hit pepper with three players in a line: the middle player sets, the outside players alternate controlled attacks and digs. Keeps a true game rhythm of three touches rather than two-person back-and-forth.",
    coachingPoints: [
      "Attackers hit at 70% - the goal is your partner digging it, not winning",
      "Diggers start low before the attacker contacts",
    ],
    youtubeQuery: "three person pepper drill",
    variations: [
      "Harder: middle player must jump set every ball",
      "Easier: catch the dig, then toss to restart",
    ],
  },
  {
    name: "Lateral Movement Passing",
    category: "passing",
    playersNeeded: 2,
    durationMinutes: 10,
    equipment: ["1 ball per pair", "2 cones"],
    skillFocus: ["lateral footwork", "passing outside the body", "platform angle"],
    positionRelevance: PASSERS,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Tosser alternates balls two steps left and two steps right of the passer, who shuffles between cones and passes back to target. Builds the shuffle-stop-pass pattern that serves attack first.",
    coachingPoints: [
      "Shuffle, don't cross feet, and arrive before the ball",
      "When beaten, angle the platform instead of swinging arms",
    ],
    youtubeQuery: "lateral movement passing drill",
    variations: [
      "Harder: tosser hits down balls instead of tossing",
      "Easier: slow the tempo and widen the passing window",
    ],
  },
  {
    name: "Net Recovery Passing",
    category: "passing",
    playersNeeded: 3,
    durationMinutes: 10,
    equipment: ["1 ball per group", "net"],
    skillFocus: ["playing balls out of the net", "scramble control", "low body position"],
    positionRelevance: BACK_ROW,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Coach or partner throws balls into the net at different heights; the passer reads the rebound and plays a controlled ball up to a target. Teaches that a netted ball is a playable ball, not a dead rally.",
    coachingPoints: [
      "Face the sideline, not the net, so the platform plays the rebound up",
      "Balls hitting the tape die fast - get under it low and early",
    ],
    youtubeQuery: "out of the net recovery drill",
    variations: [
      "Harder: passer starts at the attack line and must sprint in",
      "Easier: throw consistently into the middle of the net",
    ],
  },

  // ---------------- Hitting / Attacking (9) ----------------
  {
    name: "Approach Footwork Lines",
    category: "hitting",
    playersNeeded: 4,
    durationMinutes: 10,
    equipment: ["net"],
    skillFocus: ["4-step approach", "arm swing mechanics", "jump timing"],
    positionRelevance: HITTERS,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "No-ball repetitions of the full attack approach: slow walk-through first, then full speed left-right-left (for righties) with a maximal jump and dry swing. The foundation every hitting drill builds on.",
    coachingPoints: [
      "Last two steps are the biggest and fastest - 'step-close' explodes up",
      "Both arms swing back then drive up together",
      "Plant heel-to-toe to convert speed into height",
    ],
    youtubeQuery: "volleyball approach footwork",
    variations: [
      "Harder: add a blocking landing then re-approach (transition footwork)",
      "Easier: break it into two-step rhythm only",
    ],
  },
  {
    name: "Hitting Lines",
    category: "hitting",
    playersNeeded: 6,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["attack timing", "hitter-setter connection", "swing reps"],
    positionRelevance: HITTERS,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Classic warm-up and rep builder: hitters pass a ball to the setter, then approach and attack the set from their position. Cycle through outside, right side, and middle lines.",
    coachingPoints: [
      "Hitters wait behind the attack line until the set leaves the hands",
      "Full approach on every rep - no lazy two-step swings",
    ],
    youtubeQuery: "volleyball hitting lines",
    variations: [
      "Harder: hitter must call a zone before contact and hit it",
      "Easier: coach tosses instead of live setting",
    ],
  },
  {
    name: "High-Ball Hitting",
    category: "hitting",
    playersNeeded: 6,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["out-of-system attacking", "high-set timing", "shot selection"],
    positionRelevance: PIN_HITTERS,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Every set is a high out-of-system ball to the antenna. Hitters learn the slower timing, the higher contact, and smart shot choices against a set block instead of forcing the line swing.",
    coachingPoints: [
      "Wait, wait, then go - high balls punish early approaches",
      "Have three answers: high hands, deep cross, and a tip - power is only one option",
    ],
    youtubeQuery: "high ball hitting drill",
    variations: [
      "Harder: add a double block and keep score of kills vs errors",
      "Easier: lower, closer sets until timing stabilizes",
    ],
  },
  {
    name: "Tip and Roll Shots",
    category: "hitting",
    playersNeeded: 4,
    durationMinutes: 10,
    equipment: ["cart of balls", "net", "cones or hoops as targets"],
    skillFocus: ["off-speed shots", "shot placement", "disguise"],
    positionRelevance: PIN_HITTERS,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Hitters take full approaches but finish with tips to zone 4-behind-the-block and roll shots to deep corners, aiming at cone targets. The full-speed approach is what sells the off-speed ball.",
    coachingPoints: [
      "Same approach speed as a full swing - slowing down telegraphs it",
      "Tips with firm fingers above the tape, not a slap",
    ],
    youtubeQuery: "tip and roll shot drill",
    variations: [
      "Harder: defender reads and chases each tip",
      "Easier: no jump - groove the hand contact first",
    ],
  },
  {
    name: "Zone Hitting",
    category: "hitting",
    playersNeeded: 5,
    durationMinutes: 15,
    equipment: ["cart of balls", "net", "cones for zones 1/5/6"],
    skillFocus: ["attack placement", "cross and line control", "intentional swings"],
    positionRelevance: HITTERS,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Coach calls a target zone (deep 1, deep 5, or the 6 seam) before each set and the hitter must place the attack there. Score 2 points for the called zone, 1 for any other in-court swing, minus 1 for an error.",
    coachingPoints: [
      "Placement comes from shoulder angle and contact point, not from aiming mid-air",
      "Deep corners beat hard middles - measure success by zones, not velocity",
    ],
    youtubeQuery: "zone hitting drill",
    variations: [
      "Harder: setter calls the zone silently with a hand signal hitters must check",
      "Easier: hitter picks the zone and announces it",
    ],
  },
  {
    name: "Hit Against the Block",
    category: "hitting",
    playersNeeded: 6,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["tooling the block", "swinging high hands", "block awareness"],
    positionRelevance: PIN_HITTERS,
    difficulty: "advanced",
    ageGroupMin: "16U",
    description:
      "Hitters attack against a live double block every rep. Points for kills, wipes off the block, and recycled balls the hitter's team could replay; minus for stuff blocks and hitting errors.",
    coachingPoints: [
      "See the block before the set arrives - peripheral check during the approach",
      "When the block is set, swing high hands or cut the shot - don't donate a stuff",
    ],
    youtubeQuery: "hitting against the block drill",
    variations: [
      "Harder: block tells the hitter line or cross is taken away mid-air",
      "Easier: single blocker only",
    ],
  },
  {
    name: "Transition Attack",
    category: "hitting",
    playersNeeded: 6,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["block-to-attack transition", "footwork off the net", "conditioning"],
    positionRelevance: FRONT_ROW,
    difficulty: "advanced",
    ageGroupMin: "16U",
    description:
      "Hitter blocks a coach-hit ball, lands, transitions off the net with proper footwork, and attacks a transition set - repeated for a timed series. The game is won in transition, not in perfect first-ball swings.",
    coachingPoints: [
      "Land, turn, and sprint OFF the net before turning back in - depth creates the full approach",
      "Eyes find the ball mid-transition, not after arriving",
    ],
    youtubeQuery: "transition attack drill",
    variations: [
      "Harder: add a dig before the transition swing (block-dig-hit)",
      "Easier: skip the block, start from a net touch",
    ],
  },
  {
    name: "Quick Attack Timing",
    category: "hitting",
    playersNeeded: 3,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["first-tempo timing", "middle-setter connection", "fast arm swing"],
    positionRelevance: ["MB", "S"],
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Middle and setter rep the quick set (1-ball) from a coach-tossed pass: the middle is in the air as the setter touches the ball. Start from a standing toss, progress to live passes and transition approaches.",
    coachingPoints: [
      "Middle's last step lands as the pass reaches the setter - jump before the set",
      "Setter delivers a tight, low set to the hitter's hand, not a hittable-by-anyone ball",
    ],
    youtubeQuery: "quick set timing drill",
    variations: [
      "Harder: mix 1s, 31s, and slides on the setter's call",
      "Easier: middle attacks off a box without jumping",
    ],
  },
  {
    name: "Back-Row Attack",
    category: "hitting",
    playersNeeded: 5,
    durationMinutes: 10,
    equipment: ["cart of balls", "net"],
    skillFocus: ["pipe attack", "back-row timing", "broad jump mechanics"],
    positionRelevance: ["OH", "OPP", "RS", "UTIL"],
    difficulty: "advanced",
    ageGroupMin: "16U",
    description:
      "Hitters attack pipe and D sets taking off behind the attack line. Builds the broad-jump approach and teaches hitters to be an offensive option from the back row instead of a spectator.",
    coachingPoints: [
      "Take off behind the line, land wherever momentum carries - it's a broad jump, not a vertical",
      "Contact deep court targets; back-row swings down the line get blocked",
    ],
    youtubeQuery: "back row attack drill",
    variations: [
      "Harder: back-row attack only wins the rally in a 6-on-6 wash",
      "Easier: attack from a deeper, higher set",
    ],
  },

  // ---------------- Blocking (6) ----------------
  {
    name: "Block Footwork Along the Net",
    category: "blocking",
    playersNeeded: 4,
    durationMinutes: 10,
    equipment: ["net"],
    skillFocus: ["shuffle and crossover steps", "penetrating hands", "balanced landing"],
    positionRelevance: FRONT_ROW,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Blockers rep the two block-movement patterns down the length of the net: shuffle-step for short moves and the three-step crossover (step-crossover-hop) for long moves, jumping with pressed hands at each pin and the middle.",
    coachingPoints: [
      "Hands stay above shoulders the whole trip - no wind-up swings",
      "Press over the net on every jump; reach for their side, not your own ceiling",
      "Square shoulders to the net at landing - drifting kills the seam",
    ],
    youtubeQuery: "blocking footwork drill",
    variations: [
      "Harder: coach points directions randomly and blockers react",
      "Easier: walk through patterns without jumping",
    ],
  },
  {
    name: "Mirror Blocking",
    category: "blocking",
    playersNeeded: 2,
    durationMinutes: 10,
    equipment: ["net"],
    skillFocus: ["lateral quickness", "hand pressure", "reading movement"],
    positionRelevance: FRONT_ROW,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Two players face each other across the net; the leader moves and jumps anywhere along the net and the mirror must match them, pressing hands over each time. Sneaky conditioning plus reading practice.",
    coachingPoints: [
      "React off the leader's hips, not their head fakes",
      "Match the jump timing - a late mirror is a tooled block in a game",
    ],
    youtubeQuery: "mirror blocking drill",
    variations: [
      "Harder: leader adds delays and double jumps",
      "Easier: leader announces each move",
    ],
  },
  {
    name: "Box Blocking",
    category: "blocking",
    playersNeeded: 3,
    durationMinutes: 15,
    equipment: ["coaching box or sturdy platform", "cart of balls", "net"],
    skillFocus: ["block timing", "hand positioning", "pressing over"],
    positionRelevance: FRONT_ROW,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Coach stands on a box at the net and hits repeatable balls into a blocker's hands. Because the attack is identical every rep, blockers can groove timing, penetration, and thumb-up hand shape without chasing a live hitter.",
    coachingPoints: [
      "Jump just after the hitter's arm starts forward - blocking late beats guessing early",
      "Spread fingers, thumbs up, wrists firm - deflections come from soft hands",
    ],
    youtubeQuery: "box blocking drill",
    variations: [
      "Harder: coach mixes line and angle swings the blocker must take away on call",
      "Easier: blocker stands on a box too and only works hands",
    ],
  },
  {
    name: "Read the Setter Blocking",
    category: "blocking",
    playersNeeded: 8,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["reading the setter", "block commitment decisions", "communication"],
    positionRelevance: FRONT_ROW,
    difficulty: "advanced",
    ageGroupMin: "16U",
    description:
      "A live setter runs a real offense against a front-row of blockers whose only job is to read and front the correct hitter. Score the blockers on being in the right place with two hands over - touches and stuffs are bonus.",
    coachingPoints: [
      "Eyes sequence: pass quality, then setter's hands, then the hitter",
      "Middle blocker calls the set out loud ('four! four!') so pins trust the read",
    ],
    youtubeQuery: "read blocking drill",
    variations: [
      "Harder: setter adds dumps and middle attacks on a quick",
      "Easier: setter only sets the two pins",
    ],
  },
  {
    name: "Double-Block Closing",
    category: "blocking",
    playersNeeded: 4,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["closing the seam", "blocking together", "sealing the net"],
    positionRelevance: FRONT_ROW,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Middle blocker travels from the middle to close with a waiting pin blocker against a coach- or player-hit ball. The pin sets the line; the middle's job is arriving square with no seam between the four hands.",
    coachingPoints: [
      "Pin blocker is the anchor - set position early and hold it",
      "No seam: middle's outside hand touches the pin's inside hand in the air",
      "Both blockers penetrate together; one flat block ruins the pair",
    ],
    youtubeQuery: "double block closing drill",
    variations: [
      "Harder: hit the seam on purpose and reward seam-free blocks",
      "Easier: slow tempo sets so the middle always arrives",
    ],
  },
  {
    name: "Block-to-Defense Transition",
    category: "blocking",
    playersNeeded: 6,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["block then play defense", "rebound coverage", "repeat efforts"],
    positionRelevance: FRONT_ROW,
    difficulty: "advanced",
    ageGroupMin: "16U",
    description:
      "Blocker jumps with the first attack, lands, and must immediately play a second ball the coach hits at or behind them - then transition to attack. Trains the repeat effort that separates good blockers from one-jump blockers.",
    coachingPoints: [
      "Land looking for the next ball, not admiring the block",
      "Off the net with the outside foot first - turn and run, don't backpedal",
    ],
    youtubeQuery: "block transition defense drill",
    variations: [
      "Harder: three efforts in a row (block, dig, attack)",
      "Easier: coach tosses the second ball gently",
    ],
  },

  // ---------------- Serving (7) ----------------
  {
    name: "Target Zone Serving",
    category: "serving",
    playersNeeded: 1,
    durationMinutes: 10,
    equipment: ["cart of balls", "net", "cones or towels for zones"],
    skillFocus: ["serving accuracy", "zone targeting", "consistent toss"],
    positionRelevance: ALL,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Mark the six serving zones with cones and serve a set number of balls at each, tracking makes. The basis of every serving game plan: if you can't hit zone 1 on demand, you can't serve a scouting report.",
    coachingPoints: [
      "Same toss every time - the toss is 80% of the serve",
      "Pick the zone BEFORE the toss and hold your routine",
    ],
    youtubeQuery: "target zone serving drill",
    variations: [
      "Harder: must hit each zone twice before moving on",
      "Easier: bigger targets (half-court halves first)",
    ],
  },
  {
    name: "Pressure Serving",
    category: "serving",
    playersNeeded: 4,
    durationMinutes: 10,
    equipment: ["cart of balls", "net"],
    skillFocus: ["serving under pressure", "routine consistency", "mental reset"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "The team must make a set number of consecutive serves (e.g. 10 in a row as a group) to end the drill - a miss resets the count. Recreates the game-point nerves that cause real serve errors.",
    coachingPoints: [
      "Same pre-serve routine on rep 1 and rep 10 - the routine IS the pressure antidote",
      "After a miss, next server takes a breath and slows down instead of speeding up",
    ],
    youtubeQuery: "pressure serving drill",
    variations: [
      "Harder: last 3 serves must hit a called zone",
      "Easier: lower the consecutive target or count team makes out of 15",
    ],
  },
  {
    name: "Serving Ladder",
    category: "serving",
    playersNeeded: 2,
    durationMinutes: 10,
    equipment: ["cart of balls", "net", "cones"],
    skillFocus: ["progressive accuracy", "competition", "zone control"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Servers climb a ladder of targets: zone 1, then 5, then 6 short, then deep corners - advancing a rung with each made serve, dropping back on a miss. First to the top wins.",
    coachingPoints: [
      "Climbing slow beats falling fast - serve at 90% power you can repeat",
      "Adjust with the toss and contact point, not by aiming mid-swing",
    ],
    youtubeQuery: "serving ladder drill",
    variations: [
      "Harder: misses drop you two rungs",
      "Easier: three attempts allowed per rung",
    ],
  },
  {
    name: "Short-Deep Serving",
    category: "serving",
    playersNeeded: 2,
    durationMinutes: 10,
    equipment: ["cart of balls", "net", "cones at 3m and endline"],
    skillFocus: ["depth control", "disrupting serve receive", "tactical serving"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Alternate a short serve inside the attack line with a deep serve inside the final meter, on command. Depth changes break passers' rhythm more than raw speed does.",
    coachingPoints: [
      "Identical arm swing for both - shorten with contact, not a baby swing",
      "Deep misses long are fine in practice; short misses into the net are not",
    ],
    youtubeQuery: "short deep serving drill",
    variations: [
      "Harder: partner calls short or deep during the toss",
      "Easier: five shorts then five deeps in blocks",
    ],
  },
  {
    name: "Float Serve Progression",
    category: "serving",
    playersNeeded: 1,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["float serve technique", "no-spin contact", "toss consistency"],
    positionRelevance: ALL,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Build the float serve in stages: wall contacts for a flat hand, partner serves at 5m, then full serves from the line - watching for zero spin on every ball. The float is the highest-percentage weapon in youth volleyball.",
    coachingPoints: [
      "Contact the middle of the ball with a firm, flat hand and NO follow-through wrap",
      "Low, in-front toss - a high toss adds spin and timing error",
    ],
    youtubeQuery: "float serve technique progression",
    variations: [
      "Harder: targets plus a 'no visible spin' requirement per make",
      "Easier: serve from 6m until 8 of 10 are in",
    ],
  },
  {
    name: "Money Ball Serving",
    category: "serving",
    playersNeeded: 4,
    durationMinutes: 10,
    equipment: ["cart of balls", "1 marked ball", "net"],
    skillFocus: ["clutch serving", "simulating game points", "focus"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Servers rotate through normal reps, but one marked 'money ball' appears at random - it's worth the game. Make it and the group's score banks; miss it and the score wipes. Trains the one serve that actually decides matches.",
    coachingPoints: [
      "Treat the money ball exactly like every other serve - same routine, same target",
      "Aggressive but in: game-point serves into the net are Bank Account withdrawals",
    ],
    youtubeQuery: "money ball serving drill",
    variations: [
      "Harder: money ball must hit a called zone",
      "Easier: two lives on the money ball",
    ],
  },
  {
    name: "Serve and Sprint",
    category: "serving",
    playersNeeded: 4,
    durationMinutes: 10,
    equipment: ["cart of balls", "net"],
    skillFocus: ["serving while fatigued", "conditioning", "consistency under load"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Serve, sprint to touch the far endline, and return to serve again for a timed round - score is makes minus misses. Late-set serve errors are fatigue errors; this inoculates against them.",
    coachingPoints: [
      "Breathe and reset the routine even with a heart rate up - rushing is the error",
      "Track makes minus misses so athletes see consistency, not effort, is the score",
    ],
    youtubeQuery: "serve and sprint conditioning drill",
    variations: [
      "Harder: zone targets while fatigued",
      "Easier: shorten the sprint distance",
    ],
  },

  // ---------------- Setting (6) ----------------
  {
    name: "Wall Setting",
    category: "setting",
    playersNeeded: 1,
    durationMinutes: 10,
    equipment: ["1 ball", "wall"],
    skillFocus: ["hand shape", "contact consistency", "ball control reps"],
    positionRelevance: ["S", "UTIL"],
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "High-volume setting reps against a wall: continuous sets at a target spot, varying distance and height in rounds. The cheapest 100 quality contacts a setter can get every day.",
    coachingPoints: [
      "Ball-shaped hands above the forehead - contact the same spot every rep",
      "Finish with full extension and wrists snapping the ball, knees driving up",
    ],
    youtubeQuery: "wall setting drill",
    variations: [
      "Harder: alternate one short, one long set without losing rhythm",
      "Easier: catch and check the hand shape each rep",
    ],
  },
  {
    name: "Setter Footwork Square",
    category: "setting",
    playersNeeded: 2,
    durationMinutes: 10,
    equipment: ["1 ball", "4 cones"],
    skillFocus: ["movement to target", "square shoulders", "right-foot finish"],
    positionRelevance: ["S"],
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Tosser sends balls to the four corners of a square; the setter sprints from base to each ball and delivers a set to target, always arriving early and finishing square to the antenna with left-right footwork.",
    coachingPoints: [
      "Beat the ball there - set from stillness, not on the run",
      "Square the shoulders to zone 4 regardless of where the ball came from",
      "Finish left-right with weight moving toward the target",
    ],
    youtubeQuery: "setter footwork drill",
    variations: [
      "Harder: tosser calls front or back set as the setter moves",
      "Easier: walk pace with a coach checking each finish position",
    ],
  },
  {
    name: "Triangle Setting",
    category: "setting",
    playersNeeded: 3,
    durationMinutes: 10,
    equipment: ["1 ball per group"],
    skillFocus: ["set accuracy", "pass-set rhythm", "consistent tempo"],
    positionRelevance: ["S", "UTIL"],
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Pass from one corner of a triangle, set from the second to a catcher at the third; rotate roles. Lets young setters groove location and tempo off a real pass rather than a perfect toss.",
    coachingPoints: [
      "Set high and off the net (about an arm's length) so hitters have room",
      "Same set height every rep - tempo consistency builds hitter trust",
    ],
    youtubeQuery: "triangle setting drill",
    variations: [
      "Harder: catcher becomes a live hitter",
      "Easier: shrink the triangle distances",
    ],
  },
  {
    name: "Setter Chase",
    category: "setting",
    playersNeeded: 3,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["out-of-system setting", "hustle to second ball", "decision making"],
    positionRelevance: ["S"],
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Coach throws bad passes everywhere - off the net, into the sideline, behind the attack line - and the setter must chase from base and still deliver a hittable ball. The set that rescues a bad pass is the setter's real job description.",
    coachingPoints: [
      "First step explodes the instant the pass direction is clear",
      "When square isn't possible, a high outside bump-set beats a fancy collapse set",
    ],
    youtubeQuery: "setter chase drill",
    variations: [
      "Harder: add live hitters who must convert the rescue set",
      "Easier: limit the chase area to inside the 3m line",
    ],
  },
  {
    name: "Front-Back Setting",
    category: "setting",
    playersNeeded: 3,
    durationMinutes: 10,
    equipment: ["cart of balls", "net"],
    skillFocus: ["back setting", "deception", "identical posture"],
    positionRelevance: ["S"],
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "From the same target spot, the setter alternates front sets to zone 4 and back sets to zone 2 off identical body posture. Blockers read setters who lean - this drill removes the lean.",
    coachingPoints: [
      "Take every ball at the forehead; back sets come from hips and extension, not arched-back wind-up",
      "Hold the same posture until contact - the deception IS the skill",
    ],
    youtubeQuery: "back setting drill",
    variations: [
      "Harder: a watching 'blocker' guesses direction - beat them 7 of 10",
      "Easier: blocks of five front, five back before mixing",
    ],
  },
  {
    name: "Setter Decision Game",
    category: "setting",
    playersNeeded: 8,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["choice of set", "attacking 2nd ball", "reading the block"],
    positionRelevance: ["S"],
    difficulty: "advanced",
    ageGroupMin: "16U",
    description:
      "Live small-sided play where the setter is scored on decisions: setting the hitter with the smallest block, dumping when the blocker ignores them, and distributing so no hitter goes three rallies without a set.",
    coachingPoints: [
      "Peek at the block during the pass - the decision happens before the ball arrives",
      "Dumps are a tool, not a trick: use when the middle blocker leaves early, max twice a set",
    ],
    youtubeQuery: "setter decision making drill",
    variations: [
      "Harder: coach signals a forbidden set the setter must avoid",
      "Easier: decisions announced out loud after each rally for review",
    ],
  },

  // ---------------- Defense / Digging (6) ----------------
  {
    name: "Coach-on-Box Digging",
    category: "defense",
    playersNeeded: 4,
    durationMinutes: 15,
    equipment: ["coaching box", "cart of balls", "net"],
    skillFocus: ["digging hard-driven balls", "platform angle", "defensive posture"],
    positionRelevance: BACK_ROW,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Coach attacks from a box at the net while defenders rotate through left back, middle back, and right back, digging to a target setter. Repeatable attack angles let defenders groove reads they'll see from real hitters.",
    coachingPoints: [
      "Stopped and low before contact - moving diggers get handcuffed",
      "Dig with the platform angled to target; absorb pace, don't swing",
      "Weight on the insteps, ready to sprawl - never flat-footed heels",
    ],
    youtubeQuery: "coach on box digging drill",
    variations: [
      "Harder: mix tips and deep roll shots between hard swings",
      "Easier: hit from standing on the floor at half pace",
    ],
  },
  {
    name: "Pepper",
    category: "defense",
    playersNeeded: 2,
    durationMinutes: 10,
    equipment: ["1 ball per pair"],
    skillFocus: ["ball control", "digging", "controlled attacking"],
    positionRelevance: ALL,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "The classic two-player warm-up: pass, set, controlled hit, dig, repeat. Every player at every level peppers - the quality bar is keeping the ball playable for your partner, not past them.",
    coachingPoints: [
      "Hit AT your partner's platform - control is the entire point",
      "Diggers low and stopped before each swing",
    ],
    youtubeQuery: "volleyball pepper drill",
    variations: [
      "Harder: defender must alternate dig and overhead contact",
      "Easier: pass-set-catch until rhythm forms",
    ],
  },
  {
    name: "Six-Position Defense",
    category: "defense",
    playersNeeded: 6,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["base-to-read movement", "team defensive shape", "responsibility zones"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "A full back-court unit moves from base position to read position as the coach simulates set locations, then plays out the attacked ball. Teaches WHERE to be before working on HOW to dig.",
    coachingPoints: [
      "Move on the set, be stopped on the swing",
      "Every defender calls their responsibility ('line!', 'tip!') as the play develops",
    ],
    youtubeQuery: "team defense positioning drill",
    variations: [
      "Harder: defense must convert the dig into a full transition attack",
      "Easier: walk through rotations with frozen checkpoints",
    ],
  },
  {
    name: "Run-Throughs",
    category: "defense",
    playersNeeded: 4,
    durationMinutes: 10,
    equipment: ["cart of balls"],
    skillFocus: ["pursuit", "playing low balls on the move", "extension"],
    positionRelevance: BACK_ROW,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Coach tosses or hits balls short and away from the defender, who must run through the ball - playing it up with one or two arms mid-stride - rather than stopping to wait. The skill behind every highlight-reel pursuit.",
    coachingPoints: [
      "Play the ball mid-run with the platform to target, then keep running through it",
      "Last resort is a sprawl - feet first, then platform, then dive",
    ],
    youtubeQuery: "run through defense drill",
    variations: [
      "Harder: two balls in sequence, opposite directions",
      "Easier: predictable toss locations at slower pace",
    ],
  },
  {
    name: "Tip Coverage",
    category: "defense",
    playersNeeded: 6,
    durationMinutes: 10,
    equipment: ["cart of balls", "net"],
    skillFocus: ["reading off-speed", "covering behind the block", "first-step quickness"],
    positionRelevance: BACK_ROW,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Coach or hitters alternate hard swings with tips and short rolls behind a simulated block; defenders must read the hand and explode forward to play the short ball up. Teams that dig tips break hitters' hearts.",
    coachingPoints: [
      "Read the slowing arm and open hand - the tip telegraphs if you watch the hand, not the ball",
      "First step forward is a sprint, and call 'tip!' so teammates release too",
    ],
    youtubeQuery: "tip coverage drill",
    variations: [
      "Harder: defenders start deeper, in true base",
      "Easier: tipper announces every third ball",
    ],
  },
  {
    name: "Dig to Attack Conversion",
    category: "defense",
    playersNeeded: 6,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["dig quality", "transition offense", "scoring off defense"],
    positionRelevance: ALL,
    difficulty: "advanced",
    ageGroupMin: "16U",
    description:
      "Coach attacks at a defensive unit; a playable dig must be converted into a full set-and-swing to earn the point - a great dig that isn't converted scores nothing. Connects defense to offense the way games actually do.",
    coachingPoints: [
      "Dig HIGH and to the middle of the court, not tight to the net - give the setter options",
      "Hitters transition off the net the instant the dig goes up",
    ],
    youtubeQuery: "dig transition attack drill",
    variations: [
      "Harder: must convert three in a row to rotate",
      "Easier: coach softens to down-balls",
    ],
  },

  // ---------------- Team / Game-like (7) ----------------
  {
    name: "Queen of the Court",
    category: "team",
    playersNeeded: 9,
    durationMinutes: 20,
    equipment: ["cart of balls", "net"],
    skillFocus: ["small-group competition", "quick decisions", "winning habits"],
    positionRelevance: ALL,
    difficulty: "beginner",
    ageGroupMin: "12U",
    description:
      "Teams of three: winners stay on the 'queen' side, challengers enter every rally from the other side off a coach free ball or serve. Win the rally to take or keep the throne; lose and a new team runs on immediately.",
    coachingPoints: [
      "Three players means everyone touches - hiding is impossible",
      "Demand real three-touch volleyball even at game speed",
    ],
    youtubeQuery: "queen of the court drill",
    variations: [
      "Harder: rally only starts with a real serve",
      "Easier: every rally starts with a free ball",
    ],
  },
  {
    name: "Side-Out Wash",
    category: "team",
    playersNeeded: 12,
    durationMinutes: 20,
    equipment: ["cart of balls", "net"],
    skillFocus: ["side-out offense", "serve receive to kill", "rotation pressure"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Six-on-six where the receiving team must win BOTH the served rally and an immediate coach-entered free-ball rally to earn the rotation ('wash' if they split). Run every rotation; weakest rotations get extra rounds.",
    coachingPoints: [
      "Track which rotations wash repeatedly - that's tomorrow's practice plan",
      "Serve receive standard stays at 2+ pass even under rotation pressure",
    ],
    youtubeQuery: "wash drill volleyball",
    variations: [
      "Harder: must win three consecutive balls (serve, free, down)",
      "Easier: receiving team needs only the served rally",
    ],
  },
  {
    name: "Rotation Scrimmage",
    category: "team",
    playersNeeded: 12,
    durationMinutes: 20,
    equipment: ["cart of balls", "net", "whiteboard for scores"],
    skillFocus: ["playing every rotation", "lineup evaluation", "game situations"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Scrimmage where each rotation is its own mini-game to 4 points, then both teams rotate regardless of outcome. Surfaces exactly which rotations leak points - the data a Bank Account can't see by itself.",
    coachingPoints: [
      "Record the score per rotation - coach decisions need rotation-level data",
      "No freelancing positions: play the rotation you'd play in a real match",
    ],
    youtubeQuery: "rotation scrimmage volleyball",
    variations: [
      "Harder: losing rotation stays and must win the next mini-game to advance",
      "Easier: mini-games to 2 points to move faster",
    ],
  },
  {
    name: "Free Ball Down Ball Game",
    category: "team",
    playersNeeded: 12,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["transition offense", "ball control standards", "tempo control"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Coach alternates free balls and down balls into a six-on-six rally start; teams play out each rally with normal scoring. Free balls should be near-automatic points - this drill makes that expectation explicit and measurable.",
    coachingPoints: [
      "Score free-ball conversion as a percentage and post it - 80%+ is the club standard",
      "Down ball = defense loads behind the block line, not a panic retreat",
    ],
    youtubeQuery: "free ball down ball drill",
    variations: [
      "Harder: free-ball rallies won out-of-system count double",
      "Easier: all free balls until conversion stabilizes",
    ],
  },
  {
    name: "Plus-Minus Scrimmage",
    category: "team",
    playersNeeded: 12,
    durationMinutes: 20,
    equipment: ["cart of balls", "net", "whiteboard"],
    skillFocus: ["error reduction", "aggressive-but-smart play", "Bank Account thinking"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Normal scrimmage with Bank Account scoring layered on: aces, kills, and stuff blocks are +1 bonus, unforced errors (service errors, hitting errors, ball-handling) are -1. Teams see in real time how giveaways erase earned points.",
    coachingPoints: [
      "Narrate the math out loud: 'that ace just paid for the earlier miss'",
      "The target is aggressive serves and swings with controlled risk - not safe-mode volleyball",
    ],
    youtubeQuery: "plus minus scoring scrimmage",
    variations: [
      "Harder: unforced errors are -2",
      "Easier: only serving counts in the bonus math",
    ],
  },
  {
    name: "Scramble Game",
    category: "team",
    playersNeeded: 12,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["out-of-system play", "chaos management", "competing on bad balls"],
    positionRelevance: ALL,
    difficulty: "advanced",
    ageGroupMin: "16U",
    description:
      "Every rally starts with a deliberately ugly entry - a ball off the net, a deep shanked toss, a ball at the setter's feet - and teams must compete from chaos. Most points in real matches are won out-of-system; practice there.",
    coachingPoints: [
      "High and middle is always the bailout - eliminate panic swings at bad sets",
      "Celebrate winning ugly: the scramble point counts the same as the perfect one",
    ],
    youtubeQuery: "out of system scramble drill",
    variations: [
      "Harder: non-setters must take every second ball",
      "Easier: scramble entry only on one side, normal on the other",
    ],
  },
  {
    name: "Serve Receive to Terminal",
    category: "team",
    playersNeeded: 8,
    durationMinutes: 15,
    equipment: ["cart of balls", "net"],
    skillFocus: ["first-ball side-out", "pass-set-kill connection", "finishing"],
    positionRelevance: ALL,
    difficulty: "intermediate",
    ageGroupMin: "14U",
    description:
      "Receiving unit takes a real serve and is scored only on terminal first-ball outcomes: a first-ball kill scores, anything else (dug, error, recycled) doesn't. Run 10-ball rounds per rotation and chase a conversion percentage.",
    coachingPoints: [
      "Good pass, aggressive set choice, full swing - reward the whole chain, not just the kill",
      "Track first-ball side-out percentage by rotation; 40%+ wins most youth matches",
    ],
    youtubeQuery: "first ball side out drill",
    variations: [
      "Harder: kills must beat a live double block",
      "Easier: count any won rally, terminal or not",
    ],
  },
];

// ---------------------------------------------------------------------------
// Age-appropriate stat benchmarks
// ---------------------------------------------------------------------------

const t = (developing: number, solid: number, elite: number): StatTier => ({
  developing,
  solid,
  elite,
});

type Targets = StatBenchmarks["targets"];

// Explicit tables for the four archetype positions, then aliases. A youth
// "match" here is a typical best-of-3 (~2.5 sets).
const OH_TARGETS: Record<BenchmarkAgeGroup, Targets> = {
  "14U": {
    hittingEfficiency: t(0.0, 0.1, 0.2),
    srAverage: t(1.5, 1.8, 2.1),
    acesPerMatch: t(0.5, 1.5, 3.0),
    blocksPerMatch: t(0.2, 0.5, 1.0),
    assistsPerMatch: t(0.2, 0.5, 1.0),
    digsPerMatch: t(2.0, 4.0, 6.0),
    serveErrorRate: t(20, 12, 8),
    errorsPerMatch: t(8.0, 5.5, 3.5),
  },
  "16U": {
    hittingEfficiency: t(0.08, 0.15, 0.25),
    srAverage: t(1.7, 2.0, 2.3),
    acesPerMatch: t(0.5, 1.2, 2.5),
    blocksPerMatch: t(0.3, 0.8, 1.5),
    assistsPerMatch: t(0.2, 0.5, 1.0),
    digsPerMatch: t(3.0, 5.0, 7.5),
    serveErrorRate: t(16, 10, 7),
    errorsPerMatch: t(7.0, 5.0, 3.0),
  },
  "18U": {
    hittingEfficiency: t(0.12, 0.2, 0.3),
    srAverage: t(1.9, 2.15, 2.45),
    acesPerMatch: t(0.5, 1.0, 2.0),
    blocksPerMatch: t(0.4, 1.0, 1.8),
    assistsPerMatch: t(0.2, 0.5, 1.0),
    digsPerMatch: t(3.5, 6.0, 8.5),
    serveErrorRate: t(13, 9, 6),
    errorsPerMatch: t(6.5, 4.5, 3.0),
  },
  adult: {
    hittingEfficiency: t(0.15, 0.225, 0.32),
    srAverage: t(2.0, 2.25, 2.5),
    acesPerMatch: t(0.5, 1.0, 2.0),
    blocksPerMatch: t(0.5, 1.2, 2.0),
    assistsPerMatch: t(0.2, 0.5, 1.0),
    digsPerMatch: t(4.0, 6.5, 9.0),
    serveErrorRate: t(12, 8, 5),
    errorsPerMatch: t(6.0, 4.0, 2.5),
  },
};

const MB_TARGETS: Record<BenchmarkAgeGroup, Targets> = {
  "14U": {
    hittingEfficiency: t(0.05, 0.18, 0.3),
    srAverage: t(0, 0, 0),
    acesPerMatch: t(0.4, 1.2, 2.5),
    blocksPerMatch: t(0.4, 1.0, 2.0),
    assistsPerMatch: t(0.1, 0.3, 0.6),
    digsPerMatch: t(0.5, 1.0, 2.0),
    serveErrorRate: t(20, 13, 9),
    errorsPerMatch: t(6.0, 4.0, 2.5),
  },
  "16U": {
    hittingEfficiency: t(0.12, 0.25, 0.35),
    srAverage: t(0, 0, 0),
    acesPerMatch: t(0.4, 1.0, 2.0),
    blocksPerMatch: t(0.6, 1.5, 2.8),
    assistsPerMatch: t(0.1, 0.3, 0.6),
    digsPerMatch: t(0.5, 1.5, 2.5),
    serveErrorRate: t(16, 11, 8),
    errorsPerMatch: t(5.5, 3.8, 2.5),
  },
  "18U": {
    hittingEfficiency: t(0.18, 0.3, 0.4),
    srAverage: t(0, 0, 0),
    acesPerMatch: t(0.4, 0.9, 1.8),
    blocksPerMatch: t(1.0, 2.0, 3.5),
    assistsPerMatch: t(0.1, 0.3, 0.6),
    digsPerMatch: t(1.0, 1.8, 3.0),
    serveErrorRate: t(13, 9, 6),
    errorsPerMatch: t(5.0, 3.5, 2.2),
  },
  adult: {
    hittingEfficiency: t(0.2, 0.32, 0.42),
    srAverage: t(0, 0, 0),
    acesPerMatch: t(0.4, 0.9, 1.8),
    blocksPerMatch: t(1.2, 2.2, 3.8),
    assistsPerMatch: t(0.1, 0.3, 0.6),
    digsPerMatch: t(1.0, 2.0, 3.2),
    serveErrorRate: t(12, 8, 5),
    errorsPerMatch: t(4.5, 3.2, 2.0),
  },
};

const S_TARGETS: Record<BenchmarkAgeGroup, Targets> = {
  "14U": {
    hittingEfficiency: t(0.0, 0.1, 0.25),
    srAverage: t(0, 0, 0),
    acesPerMatch: t(0.5, 1.5, 3.0),
    blocksPerMatch: t(0.1, 0.4, 0.9),
    assistsPerMatch: t(6.0, 10.0, 15.0),
    digsPerMatch: t(1.5, 3.0, 5.0),
    serveErrorRate: t(18, 11, 7),
    errorsPerMatch: t(5.5, 3.8, 2.5),
  },
  "16U": {
    hittingEfficiency: t(0.05, 0.15, 0.3),
    srAverage: t(0, 0, 0),
    acesPerMatch: t(0.5, 1.2, 2.5),
    blocksPerMatch: t(0.2, 0.6, 1.2),
    assistsPerMatch: t(9.0, 14.0, 20.0),
    digsPerMatch: t(2.0, 4.0, 6.0),
    serveErrorRate: t(15, 10, 6),
    errorsPerMatch: t(5.0, 3.5, 2.2),
  },
  "18U": {
    hittingEfficiency: t(0.1, 0.2, 0.35),
    srAverage: t(0, 0, 0),
    acesPerMatch: t(0.5, 1.0, 2.0),
    blocksPerMatch: t(0.3, 0.8, 1.5),
    assistsPerMatch: t(12.0, 18.0, 25.0),
    digsPerMatch: t(2.5, 4.5, 7.0),
    serveErrorRate: t(12, 8, 5),
    errorsPerMatch: t(4.5, 3.2, 2.0),
  },
  adult: {
    hittingEfficiency: t(0.12, 0.22, 0.38),
    srAverage: t(0, 0, 0),
    acesPerMatch: t(0.5, 1.0, 2.0),
    blocksPerMatch: t(0.4, 0.9, 1.6),
    assistsPerMatch: t(14.0, 20.0, 28.0),
    digsPerMatch: t(3.0, 5.0, 7.5),
    serveErrorRate: t(11, 7, 4),
    errorsPerMatch: t(4.0, 3.0, 1.8),
  },
};

const L_TARGETS: Record<BenchmarkAgeGroup, Targets> = {
  "14U": {
    hittingEfficiency: t(0, 0, 0),
    srAverage: t(1.7, 2.0, 2.3),
    acesPerMatch: t(0.5, 1.5, 3.0),
    blocksPerMatch: t(0, 0, 0),
    assistsPerMatch: t(0.3, 0.8, 1.5),
    digsPerMatch: t(4.0, 7.0, 10.0),
    serveErrorRate: t(16, 10, 6),
    errorsPerMatch: t(4.0, 2.8, 1.8),
  },
  "16U": {
    hittingEfficiency: t(0, 0, 0),
    srAverage: t(1.9, 2.2, 2.5),
    acesPerMatch: t(0.5, 1.2, 2.5),
    blocksPerMatch: t(0, 0, 0),
    assistsPerMatch: t(0.4, 1.0, 1.8),
    digsPerMatch: t(5.0, 8.5, 12.0),
    serveErrorRate: t(13, 8, 5),
    errorsPerMatch: t(3.5, 2.5, 1.5),
  },
  "18U": {
    hittingEfficiency: t(0, 0, 0),
    srAverage: t(2.05, 2.3, 2.55),
    acesPerMatch: t(0.5, 1.0, 2.0),
    blocksPerMatch: t(0, 0, 0),
    assistsPerMatch: t(0.5, 1.2, 2.0),
    digsPerMatch: t(6.0, 10.0, 14.0),
    serveErrorRate: t(11, 7, 4),
    errorsPerMatch: t(3.0, 2.2, 1.3),
  },
  adult: {
    hittingEfficiency: t(0, 0, 0),
    srAverage: t(2.1, 2.35, 2.6),
    acesPerMatch: t(0.5, 1.0, 2.0),
    blocksPerMatch: t(0, 0, 0),
    assistsPerMatch: t(0.5, 1.2, 2.2),
    digsPerMatch: t(7.0, 11.0, 15.0),
    serveErrorRate: t(10, 6, 4),
    errorsPerMatch: t(2.8, 2.0, 1.2),
  },
};

const AGE_GROUPS: BenchmarkAgeGroup[] = ["14U", "16U", "18U", "adult"];

// RS/OPP attack more from the right pin and pass less than OH; DS mirrors L
// with slightly lower volume; UTIL is evaluated like an OH.
function rsTargets(base: Targets): Targets {
  return { ...base, srAverage: t(0, 0, 0), digsPerMatch: t(1.5, 3.0, 5.0) };
}
function dsTargets(base: Targets): Targets {
  return {
    ...base,
    digsPerMatch: t(
      base.digsPerMatch.developing * 0.75,
      base.digsPerMatch.solid * 0.75,
      base.digsPerMatch.elite * 0.75,
    ),
  };
}

export const BENCHMARKS: StatBenchmarks[] = AGE_GROUPS.flatMap((age) => [
  { position: "OH" as Position, ageGroup: age, targets: OH_TARGETS[age] },
  { position: "UTIL" as Position, ageGroup: age, targets: OH_TARGETS[age] },
  { position: "RS" as Position, ageGroup: age, targets: rsTargets(OH_TARGETS[age]) },
  { position: "OPP" as Position, ageGroup: age, targets: rsTargets(OH_TARGETS[age]) },
  { position: "MB" as Position, ageGroup: age, targets: MB_TARGETS[age] },
  { position: "S" as Position, ageGroup: age, targets: S_TARGETS[age] },
  { position: "L" as Position, ageGroup: age, targets: L_TARGETS[age] },
  { position: "DS" as Position, ageGroup: age, targets: dsTargets(L_TARGETS[age]) },
]);

// Which benchmark keys are meaningful per position - zeros above mean
// "not this position's job" and must never be rendered as a target.
const RELEVANT_KEYS: Record<Position, (keyof Targets)[]> = {
  OH: ["hittingEfficiency", "srAverage", "acesPerMatch", "blocksPerMatch", "digsPerMatch", "serveErrorRate", "errorsPerMatch"],
  UTIL: ["hittingEfficiency", "srAverage", "acesPerMatch", "blocksPerMatch", "digsPerMatch", "serveErrorRate", "errorsPerMatch"],
  RS: ["hittingEfficiency", "acesPerMatch", "blocksPerMatch", "digsPerMatch", "serveErrorRate", "errorsPerMatch"],
  OPP: ["hittingEfficiency", "acesPerMatch", "blocksPerMatch", "digsPerMatch", "serveErrorRate", "errorsPerMatch"],
  MB: ["hittingEfficiency", "blocksPerMatch", "acesPerMatch", "serveErrorRate", "errorsPerMatch"],
  S: ["assistsPerMatch", "acesPerMatch", "blocksPerMatch", "digsPerMatch", "serveErrorRate", "errorsPerMatch"],
  L: ["srAverage", "digsPerMatch", "acesPerMatch", "serveErrorRate", "errorsPerMatch"],
  DS: ["srAverage", "digsPerMatch", "acesPerMatch", "serveErrorRate", "errorsPerMatch"],
};

const LOWER_IS_BETTER = new Set<keyof Targets>(["serveErrorRate", "errorsPerMatch"]);

// ---------------------------------------------------------------------------
// Position coaching frameworks
// ---------------------------------------------------------------------------

export const POSITION_FRAMEWORKS: PositionFramework[] = [
  {
    position: "OH",
    eliteProfile:
      "An elite outside hitter is the team's six-rotation problem solver: they pass in serve receive, terminate both in-system and high out-of-system balls, and defend in the back row. They score against a set double block by mixing power with high hands, deep corners, and off-speed shots. Most importantly, they want the ball when the pass is bad - the high outside set is the team's bailout, and elite OHs convert it.",
    developmentPriorities: [
      "Consistent 4-step approach with a full arm swing on every attack",
      "Serve receive passing - an OH who can't pass becomes a one-rotation player",
      "Out-of-system high-ball attacking with multiple shot choices",
      "Back-row defense and transition footwork off the net",
      "Reading and tooling the block instead of avoiding it",
    ],
    commonMistakes: {
      "14U": "Hitting every ball as hard as possible with no plan B - tips and roll shots feel like 'giving up' at this age but are actually point scorers.",
      "16U": "Avoiding serve receive responsibility and drifting into hitting-only habits; broken approach footwork on out-of-system balls.",
      "18U": "Predictable shot selection under pressure (always cross-court) and swinging into a set double block instead of using high hands or recycling.",
    },
    bankAccountNotes:
      "OHs touch the most balls, so they have the biggest Bank Account swings. Kills and 3-passes are their main deposits; attack errors and shanked passes their main withdrawals. A high-volume hitter at -2 may be more valuable than a low-volume hitter at +1 - check attempts before judging the balance.",
    mentalGame:
      "Next-ball mentality is everything: OHs get set the most, so they also get blocked the most. Teach a 5-second reset routine after errors. Elite OHs call for the ball after a mistake - hiding after errors is the habit to break early.",
  },
  {
    position: "RS",
    eliteProfile:
      "An elite right side is the mirror-image counterweight: they block the opponent's best outside hitter every rally, attack effectively from zone 2 against the seam, and give the setter a second-ball threat the defense must respect. Strong RS play is built on blocking first - the position exists to put a wall in front of the opponent's go-to attacker - with a quick, compact left-shoulder swing as the offensive payoff.",
    developmentPriorities: [
      "Blocking technique and positioning against the opponent's outside",
      "Attacking from the right pin where the set comes across the body",
      "Transition footwork from blocking to a full approach",
      "Serving as a weapon - RSs often carry a big float or jump serve",
      "Back-row defense in zone 1 against line shots",
    ],
    commonMistakes: {
      "14U": "Treating blocking as optional and floating off the net; uncomfortable hitting sets that travel across their body.",
      "16U": "Reaching instead of moving feet on the block, giving up the line; one-speed attacking with no cut shot back to zone 4.",
      "18U": "Late block closes against quicker outside sets, and failing to punish the seam when the opposing setter is front-row.",
    },
    bankAccountNotes:
      "RS deposits come from blocks and right-side kills; their withdrawals are usually block errors (netting, reaching) and attack errors against a set block. Blocks are heavily weighted deposits - one stuff per match materially moves an RS's balance.",
    mentalGame:
      "Right sides live in one-on-one matchups against the opponent's best hitter. Teach them to win the war, not every rally: getting touched five times then stuffing the set-deciding swing is a winning night. Patience plus matchup pride is the RS mentality.",
  },
  {
    position: "MB",
    eliteProfile:
      "An elite middle blocker influences every single rally without needing the ball: they front the opposing offense, close to both pins, and erase the middle of the net. Offensively they hit a high-efficiency quick attack that forces the opposing middle to honor them, opening up the pins. Their value shows up in teammates' numbers as much as their own - a feared quick attack is a gift to the outside hitters.",
    developmentPriorities: [
      "Block footwork: shuffle and 3-step crossover to both antennas, arriving square",
      "Quick-attack timing - in the air as the setter touches the ball",
      "Reading the setter to commit or release on the block",
      "Transition footwork off the net into an available attack every rally",
      "Slide attack footwork to expand the offensive arsenal",
    ],
    commonMistakes: {
      "14U": "Watching rallies instead of jumping every play - young middles often take plays off when the set goes elsewhere.",
      "16U": "Guessing on the block instead of reading, and approaching late so the quick set is never actually available.",
      "18U": "Drifting on the block (sealing nothing), and disappearing offensively in transition instead of demanding the ball after every dig.",
    },
    bankAccountNotes:
      "Middles play fewer back-row rotations, so they bank fewer touches - their balance is built on blocks and efficient kills, with serve errors as the classic leak. Never compare a middle's raw balance to an OH's; the Bank Account position groups exist exactly because their jobs differ.",
    mentalGame:
      "Middles need relentless energy without reward: they jump on every rally and get set the least. Praise the invisible work out loud - touches that slow attacks, blocks that channel hitters into diggers. Elite middles take pride in the team's defensive numbers, not just their own kill count.",
  },
  {
    position: "S",
    eliteProfile:
      "An elite setter is the on-court coach: they deliver a hittable ball from any pass location, distribute so every hitter stays dangerous, and make block-beating decisions rally after rally. Their hands are consistent enough that hitters never think about the set - only the swing. Above all they elevate teammates: the best setters make average hitters look good and good hitters look elite.",
    developmentPriorities: [
      "Consistent, legal hands delivering the same ball tempo every time",
      "Footwork to beat the pass to target and set from stillness",
      "Out-of-system rescue setting - the high outside bailout under chaos",
      "Decision-making: feeding the hot hitter, attacking matchups, smart dumps",
      "Communication and leadership - running the offense out loud",
    ],
    commonMistakes: {
      "14U": "Setting from wherever they catch the ball instead of moving feet first; trying to be fancy (jump sets, dumps) before clean basics.",
      "16U": "Forcing the quick attack off medium passes, predictable distribution in crunch time, and silent play - no communication with hitters between rallies.",
      "18U": "Under-using the second-ball attack when blockers ignore them, and failing to manage hitters emotionally - elite setters feed a struggling hitter the confidence ball at the right moment.",
    },
    bankAccountNotes:
      "Setter deposits come from assists, aces, and the occasional kill on the dump; withdrawals from ball-handling errors and serve errors. Their balance understates their value by design - a setter's real fingerprint is the team's hitting efficiency, so read their Bank Account alongside the hitters' numbers.",
    mentalGame:
      "Setters absorb blame in both directions - bad pass or bad swing, the set gets questioned. Build emotional flatness: same body language at 24-22 up or down. Teach them to deliver one specific positive instruction per huddle; setters who talk win close sets.",
  },
  {
    position: "L",
    eliteProfile:
      "An elite libero owns the back court: they take the biggest serve-receive load at the highest pass quality, dig balls that should hit the floor, and turn chaos into in-system offense. They communicate constantly - calling serves in or out, claiming seams, directing coverage. The libero sets the team's defensive identity; when the libero is fearless, the whole team defends bigger.",
    developmentPriorities: [
      "Serve receive excellence - the highest SR average on the roster is the job",
      "Defensive reading: positioning before the swing, not reactions after it",
      "Pursuit and extension skills - run-throughs, sprawls, playing balls off the net",
      "Out-of-system setting from the back court when the setter digs the ball",
      "Vocal leadership - the libero is the back-court quarterback",
    ],
    commonMistakes: {
      "14U": "Calling 'mine' late or not at all, and diving for show when two more steps would mean playing it standing up.",
      "16U": "Taking low-percentage overhand receives on floaters instead of moving the feet, and hiding from seam responsibility next to weaker passers.",
      "18U": "Coasting on athleticism instead of pre-serve study - elite 18U liberos know the opposing servers' tendencies by set two - and inconsistent bump-setting on the setter-dug ball.",
    },
    bankAccountNotes:
      "The Bank Account judges liberos on their actual job: 3-passes and digs are deposits, reception errors and serve errors are withdrawals - hitting numbers are excluded entirely. Liberos and DSs often carry the team's most stable positive balances; protect that by never measuring them on stats they're not allowed to produce.",
    mentalGame:
      "Liberos must have a goldfish memory - a shanked pass cannot follow them to the next serve, because the next serve is coming at them on purpose. Build pride in effort plays: the save that leads to a teammate's kill belongs to the libero too, even though the stat sheet says otherwise.",
  },
  {
    position: "DS",
    eliteProfile:
      "An elite defensive specialist changes the game from the bench: they enter for a front-row player and immediately stabilize serve receive and back-row defense, often while serving a high-pressure ball in the same rotation. The role demands instant readiness - cold off the bench into a 23-23 serve receive - and zero ego, because their best work shows up as someone else's kill.",
    developmentPriorities: [
      "Entering cold and passing immediately - readiness routines on the bench",
      "Serve receive technique equal to the libero's standard",
      "Aggressive, reliable serving - many DSs are their team's best server",
      "Defensive reading and pursuit in the seams the libero doesn't cover",
      "Communication that adds a second loud voice to the back court",
    ],
    commonMistakes: {
      "14U": "Checking out mentally on the bench and entering flat-footed; treating the DS rotation as 'less important' than starting.",
      "16U": "Playing it safe with the serve when the team needs pressure - the DS who serves a 50% lollipop wastes their best weapon.",
      "18U": "Failing to study opponents from the bench - the DS has the best scouting seat in the gym and elite ones enter with a plan for where the opposing hitters score.",
    },
    bankAccountNotes:
      "DSs bank like liberos - SR quality, digs, and aces - but in fewer rotations, so each touch moves the balance more. A DS with a positive balance in limited touches is doing exactly their job; reward the efficiency, not the raw total.",
    mentalGame:
      "The DS mentality is professional readiness: warm body, warm mind, every set, whether they enter or not. Teach a personal entry routine (3 deep breaths, call the score, claim a seam out loud). The DS who treats six touches like sixty becomes a starter.",
  },
];

// ---------------------------------------------------------------------------
// Practice plan templates
// ---------------------------------------------------------------------------

export const PRACTICE_TEMPLATES: PracticePlanTemplate[] = [
  {
    name: "Pre-Tournament Practice",
    whenToUse:
      "The last 1-2 practices before a tournament. Sharpen, don't install: game-speed reps, serving and serve receive volume, and confidence-building competition. Nothing new gets taught this week.",
    phases: [
      { phase: "Warmup", minutes: 10, guidance: "Pepper or Three-Person Pepper - ball control with light movement." },
      { phase: "Skill block 1", minutes: 15, guidance: "Serve receive at game pressure: Servers vs. Passers or 21 Points Passing with the starting receive patterns." },
      { phase: "Skill block 2", minutes: 15, guidance: "Serving zones the game plan calls for: Target Zone Serving or Pressure Serving (end on a made streak for confidence)." },
      { phase: "Team drill", minutes: 20, guidance: "Side-Out Wash or Rotation Scrimmage through ALL six rotations - extra reps for any rotation that leaked points last tournament." },
      { phase: "Cooldown", minutes: 5, guidance: "Light serving or free-ball passing while reviewing the tournament schedule, lineups, and one team goal." },
    ],
  },
  {
    name: "Weakness-Targeting Practice",
    whenToUse:
      "After reviewing Bank Account data: pick the 1-2 largest team-wide withdrawal categories (e.g. serve errors, reception errors, attack errors) and build the practice around exactly those leaks.",
    phases: [
      { phase: "Warmup", minutes: 10, guidance: "Pepper variants biased toward the weak skill (e.g. dig-heavy pepper if digs are the leak)." },
      { phase: "Skill block 1", minutes: 15, guidance: "Technical drill attacking withdrawal #1 - e.g. Float Serve Progression + Pressure Serving for serve errors, Butterfly or 21 Points Passing for reception errors." },
      { phase: "Skill block 2", minutes: 15, guidance: "Technical drill for withdrawal #2, or the same skill from block 1 at higher pressure with individualized groups by Bank Account data." },
      { phase: "Team drill", minutes: 20, guidance: "Plus-Minus Scrimmage so the targeted error type visibly costs points - call out the Bank Account math during play." },
      { phase: "Cooldown", minutes: 5, guidance: "Stretch while sharing each player's single focus stat for the next match." },
    ],
  },
  {
    name: "Passing-Focused Practice",
    whenToUse:
      "When team SR average is below target or serve receive breaks down under pressure. Touch volume is the cure: every athlete should log 100+ quality pass contacts.",
    phases: [
      { phase: "Warmup", minutes: 10, guidance: "Lateral Movement Passing and Triangle Passing - footwork and platform shape before volume." },
      { phase: "Skill block 1", minutes: 15, guidance: "Butterfly Drill for continuous serve-receive flow, or Short-Deep Serve Receive if depth reading is the specific leak." },
      { phase: "Skill block 2", minutes: 15, guidance: "Competitive grading: 21 Points Passing or Servers vs. Passers so every pass earns a 0-3 score, mirroring the SR stat." },
      { phase: "Team drill", minutes: 20, guidance: "Serve Receive to Terminal - connect the good pass to the kill it's supposed to create, tracked by rotation." },
      { phase: "Cooldown", minutes: 5, guidance: "Partner passing at conversation pace; review individual SR averages vs the age-group benchmark." },
    ],
  },
  {
    name: "Attacking-Focused Practice",
    whenToUse:
      "When hitting efficiency is below benchmark or hitters are error-heavy. Build from footwork to shots to live blocks - efficiency comes from shot choices, not harder swings.",
    phases: [
      { phase: "Warmup", minutes: 10, guidance: "Approach Footwork Lines (no ball), then short Hitting Lines to groove timing." },
      { phase: "Skill block 1", minutes: 15, guidance: "Zone Hitting or Tip and Roll Shots - placement and off-speed before power. Middles split off for Quick Attack Timing." },
      { phase: "Skill block 2", minutes: 15, guidance: "High-Ball Hitting or Hit Against the Block, matching difficulty to the group's age and level." },
      { phase: "Team drill", minutes: 20, guidance: "Free Ball Down Ball Game or Dig to Attack Conversion - attacking out of transition, where matches are actually won." },
      { phase: "Cooldown", minutes: 5, guidance: "Light serving; review each hitter's efficiency and error count vs the age-group benchmark." },
    ],
  },
  {
    name: "General Development Practice",
    whenToUse:
      "Default mid-season practice when no single weakness dominates: balanced touches across skills with a competitive team finish.",
    phases: [
      { phase: "Warmup", minutes: 10, guidance: "Three-Person Pepper - all three contacts in one drill." },
      { phase: "Skill block 1", minutes: 15, guidance: "Split by position: passers in Butterfly, setters in Setter Footwork Square or Setter Chase, middles in Block Footwork Along the Net." },
      { phase: "Skill block 2", minutes: 15, guidance: "Attack/defense pairing: Hitting Lines against Coach-on-Box Digging groups, then rotate." },
      { phase: "Team drill", minutes: 20, guidance: "Queen of the Court or Scramble Game - small-sided competition with maximum touches per athlete." },
      { phase: "Cooldown", minutes: 5, guidance: "Stretch and one teaching point per player from today's data." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers for prompt building
// ---------------------------------------------------------------------------

// "16U" from team.ageGroup strings like "16U", "U16", "16s", "Under 16".
export function parseAgeGroup(raw: string | null | undefined): BenchmarkAgeGroup {
  const m = raw?.match(/1[2-8]/)?.[0];
  if (!m) return /adult|senior|college|uni/i.test(raw ?? "") ? "adult" : "16U";
  const n = parseInt(m, 10);
  if (n <= 14) return "14U"; // 12U teams use 14U targets as a stretch goal
  if (n <= 16) return "16U";
  return "18U";
}

export function drillsForPosition(position: Position): Drill[] {
  return DRILLS.filter((d) => d.positionRelevance.includes(position));
}

export function benchmarksFor(
  position: Position,
  ageGroup: BenchmarkAgeGroup,
): StatBenchmarks | undefined {
  return BENCHMARKS.find((b) => b.position === position && b.ageGroup === ageGroup);
}

const KEY_LABELS: Record<keyof Targets, string> = {
  hittingEfficiency: "Hitting efficiency",
  srAverage: "SR average (0-3)",
  acesPerMatch: "Aces/match",
  blocksPerMatch: "Blocks/match",
  assistsPerMatch: "Assists/match",
  digsPerMatch: "Digs/match",
  serveErrorRate: "Serve error % (lower is better)",
  errorsPerMatch: "Errors/match (lower is better)",
};

// One line per relevant stat: "SR average (0-3): developing 1.9 / solid 2.2 / elite 2.5"
export function renderBenchmarks(position: Position, ageGroup: BenchmarkAgeGroup): string {
  const b = benchmarksFor(position, ageGroup);
  if (!b) return "";
  return RELEVANT_KEYS[position]
    .map((k) => {
      const tier = b.targets[k];
      return `  ${KEY_LABELS[k]}: developing ${tier.developing} / solid ${tier.solid} / elite ${tier.elite}`;
    })
    .join("\n");
}

export function isLowerBetter(key: keyof Targets): boolean {
  return LOWER_IS_BETTER.has(key);
}

// Compact one-drill render for prompt context.
export function renderDrillCompact(d: Drill): string {
  return (
    `- ${d.name} [${d.category}] (${d.playersNeeded}p, ${d.durationMinutes}min, ${d.difficulty}, ${d.ageGroupMin}+) ` +
    `positions: ${d.positionRelevance.join("/")}. ${d.description.split(". ")[0]}. ` +
    `Key point: ${d.coachingPoints[0]}. youtubeQuery: "${d.youtubeQuery}"`
  );
}

export function renderDrillList(drills: Drill[]): string {
  return drills.map(renderDrillCompact).join("\n");
}

// Condensed frameworks for the chat prompt - full prose stays in code for
// player-focused contexts.
export function renderFrameworksCondensed(): string {
  return POSITION_FRAMEWORKS.map(
    (f) =>
      `${f.position}: Elite = ${f.eliteProfile.split(". ")[0]}. ` +
      `Priorities: ${f.developmentPriorities.slice(0, 3).join("; ")}. ` +
      `Bank Account: ${f.bankAccountNotes.split(". ")[0]}. ` +
      `Mental: ${f.mentalGame.split(". ")[0]}.`,
  ).join("\n");
}

export function renderFrameworkFull(position: Position): string {
  const f =
    POSITION_FRAMEWORKS.find((x) => x.position === position) ??
    // OPP coaches like an RS; UTIL like an OH.
    POSITION_FRAMEWORKS.find(
      (x) => x.position === (position === "OPP" ? "RS" : "OH"),
    );
  if (!f) return "";
  return [
    `Elite profile: ${f.eliteProfile}`,
    `Development priorities (in order): ${f.developmentPriorities.join("; ")}`,
    `Bank Account lens: ${f.bankAccountNotes}`,
    `Mental game: ${f.mentalGame}`,
  ].join("\n");
}

export function renderPracticeTemplates(): string {
  return PRACTICE_TEMPLATES.map(
    (tpl) =>
      `${tpl.name} - ${tpl.whenToUse}\n` +
      tpl.phases
        .map((p) => `  ${p.phase} (${p.minutes} min): ${p.guidance}`)
        .join("\n"),
  ).join("\n\n");
}
