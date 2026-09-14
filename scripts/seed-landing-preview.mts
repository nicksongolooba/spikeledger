// Landing-page preview data: the "Lakeshore Storm" coach whose screens appear
// on the marketing site (src/assets/screens/*). Same generators as
// prisma/seed.ts, but ADDS one throwaway coach with three teams instead of
// wiping the database, and writes the ids + a random password to a JSON file
// for scripts/capture-landing-screens.mts.
//
//   node --import tsx scripts/seed-landing-preview.mts            # create
//   node --import tsx scripts/seed-landing-preview.mts --delete   # remove the coach again
//   PREVIEW_IDS=/path/ids.json ...                                # where to write the ids
import { Position, MatchResult } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Deterministic RNG - same seed produces the same demo dataset every time.
// ---------------------------------------------------------------------------
function mulberry32(a: number) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260515);
function ri(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// Roster - order matches the Phase 1 spec exactly.
// ---------------------------------------------------------------------------
interface SeedPlayer {
  name: string;
  number: number;
  primaryPosition: Position;
  secondaryPosition?: Position;
}

const ROSTER: SeedPlayer[] = [
  { name: "Maya", number: 7, primaryPosition: "OH" },
  { name: "Zara", number: 12, primaryPosition: "OH" },
  { name: "Nia", number: 8, primaryPosition: "RS" },
  { name: "Priya", number: 11, primaryPosition: "RS" },
  { name: "Jordan", number: 6, primaryPosition: "RS", secondaryPosition: "L" },
  { name: "Riley", number: 1, primaryPosition: "S" },
  { name: "Tess", number: 3, primaryPosition: "MB" },
  { name: "Kira", number: 9, primaryPosition: "MB" },
  { name: "Lena", number: 4, primaryPosition: "MB" },
  { name: "Mika", number: 10, primaryPosition: "S" },
  { name: "Jade", number: 5, primaryPosition: "L" },
  { name: "Sam", number: 2, primaryPosition: "L", secondaryPosition: "S" },
];

// ---------------------------------------------------------------------------
// Tournaments & match record per the spec.
// ---------------------------------------------------------------------------
const TOURNAMENTS = [
  {
    name: "16U Tournament 1",
    startDate: new Date("2025-11-15"),
    endDate: new Date("2025-11-16"),
    location: "Etobicoke Olympium",
    results: [MatchResult.LOSS, MatchResult.WIN, MatchResult.LOSS, MatchResult.LOSS],
    errorBias: 1, // tournament 1: a touch more errors
    killBias: 0,
  },
  {
    name: "16U Tournament 2",
    startDate: new Date("2025-12-06"),
    endDate: new Date("2025-12-07"),
    location: "Markham Pan Am Centre",
    results: [MatchResult.WIN, MatchResult.LOSS, MatchResult.WIN, MatchResult.LOSS],
    errorBias: 0,
    killBias: 0,
  },
  {
    name: "16U Tournament 3",
    startDate: new Date("2026-01-10"),
    endDate: new Date("2026-01-11"),
    location: "Toronto Pan Am Sports Centre",
    results: [MatchResult.WIN, MatchResult.WIN, MatchResult.LOSS, MatchResult.WIN],
    errorBias: -1, // tournament 3: cleaner play
    killBias: 1,
  },
];

const OPPONENTS = [
  "Central Thunder",
  "West Coast Elite",
  "Metro Volleyball",
  "Storm Volleyball",
  "Valley Vipers",
  "Metro Tigers",
  "Summit Spikers",
  "Coastal Crush",
];

// ---------------------------------------------------------------------------
// Per-position stat generators. Each takes optional biases to nudge totals
// across the season (more errors early, more kills late).
// ---------------------------------------------------------------------------
interface StatLineSeed {
  kills: number;
  attackErrors: number;
  attackAttempts: number;
  aces: number;
  serveErrors: number;
  serveAttempts: number;
  blocks: number;
  blockErrors: number;
  assists: number;
  settingErrors: number;
  sr0: number;
  sr1: number;
  sr2: number;
  sr3: number;
  generalErrors: number;
  digs: number;
  setsPlayed: number;
  positionPlayed: Position;
}

interface Bias {
  errorBias: number;
  killBias: number;
}

function clamp(n: number, min = 0) {
  return Math.max(min, n);
}

function setsForMatch() {
  // Matches are 2 or 3 sets at this age group.
  return rand() < 0.45 ? 3 : 2;
}

function makeOH(b: Bias): StatLineSeed {
  const sets = setsForMatch();
  const kills = clamp(ri(5, 12) + b.killBias);
  const attackErrors = clamp(ri(2, 5) + b.errorBias);
  const aces = ri(1, 3);
  const serveErrors = clamp(ri(1, 3) + b.errorBias);
  const blocks = ri(0, 2);
  return {
    kills,
    attackErrors,
    attackAttempts: kills + attackErrors + ri(3, 7),
    aces,
    serveErrors,
    serveAttempts: aces + serveErrors + ri(3, 6),
    blocks,
    blockErrors: ri(0, 1),
    assists: ri(0, 1),
    settingErrors: 0,
    sr0: ri(0, 2),
    sr1: ri(1, 3),
    sr2: ri(2, 5),
    sr3: ri(1, 3),
    generalErrors: clamp(ri(1, 4) + b.errorBias),
    digs: ri(2, 6),
    setsPlayed: sets,
    positionPlayed: "OH",
  };
}

function makeRS(b: Bias): StatLineSeed {
  const sets = setsForMatch();
  const kills = clamp(ri(5, 11) + b.killBias);
  const attackErrors = clamp(ri(2, 5) + b.errorBias);
  const aces = ri(1, 3);
  const serveErrors = clamp(ri(1, 3) + b.errorBias);
  const blocks = ri(0, 2);
  return {
    kills,
    attackErrors,
    attackAttempts: kills + attackErrors + ri(3, 7),
    aces,
    serveErrors,
    serveAttempts: aces + serveErrors + ri(3, 6),
    blocks,
    blockErrors: ri(0, 1),
    assists: ri(0, 1),
    settingErrors: 0,
    sr0: ri(0, 2),
    sr1: ri(1, 3),
    sr2: ri(2, 4),
    sr3: ri(1, 3),
    generalErrors: clamp(ri(1, 4) + b.errorBias),
    digs: ri(1, 4),
    setsPlayed: sets,
    positionPlayed: "RS",
  };
}

function makeMB(b: Bias): StatLineSeed {
  const sets = setsForMatch();
  const kills = clamp(ri(2, 6) + b.killBias);
  const attackErrors = clamp(ri(1, 3) + b.errorBias);
  const aces = ri(1, 2);
  const serveErrors = ri(0, 2);
  const blocks = clamp(ri(2, 5) + b.killBias);
  return {
    kills,
    attackErrors,
    attackAttempts: kills + attackErrors + ri(2, 5),
    aces,
    serveErrors,
    serveAttempts: aces + serveErrors + ri(2, 5),
    blocks,
    blockErrors: ri(0, 2),
    assists: ri(0, 1),
    settingErrors: 0,
    sr0: 0,
    sr1: ri(0, 1),
    sr2: ri(0, 1),
    sr3: 0,
    generalErrors: clamp(ri(0, 3) + b.errorBias),
    digs: ri(0, 2),
    setsPlayed: sets,
    positionPlayed: "MB",
  };
}

function makeSetter(b: Bias): StatLineSeed {
  const sets = setsForMatch();
  const assists = clamp(ri(8, 20) + b.killBias);
  const settingErrors = clamp(ri(0, 2) + Math.max(0, b.errorBias));
  return {
    kills: ri(0, 2),
    attackErrors: ri(0, 1),
    attackAttempts: ri(0, 3),
    aces: ri(1, 3),
    serveErrors: clamp(ri(0, 2) + b.errorBias),
    serveAttempts: ri(3, 7),
    blocks: ri(1, 3),
    blockErrors: ri(0, 1),
    assists,
    settingErrors,
    sr0: 0,
    sr1: ri(0, 1),
    sr2: ri(0, 1),
    sr3: 0,
    generalErrors: clamp(ri(1, 3) + b.errorBias),
    digs: ri(1, 4),
    setsPlayed: sets,
    positionPlayed: "S",
  };
}

function makeLibero(b: Bias): StatLineSeed {
  const sets = setsForMatch();
  return {
    kills: 0,
    attackErrors: 0,
    attackAttempts: 0,
    aces: ri(0, 2),
    serveErrors: clamp(ri(0, 1) + Math.max(0, b.errorBias)),
    serveAttempts: ri(2, 5),
    blocks: 0,
    blockErrors: 0,
    assists: ri(0, 2),
    settingErrors: 0,
    sr0: clamp(ri(0, 2) + Math.max(0, b.errorBias)),
    sr1: ri(2, 4),
    sr2: clamp(ri(4, 7) + Math.max(0, -b.errorBias)),
    sr3: clamp(ri(2, 5) + Math.max(0, b.killBias)),
    generalErrors: clamp(ri(0, 2) + Math.max(0, b.errorBias)),
    digs: ri(5, 15),
    setsPlayed: sets,
    positionPlayed: "L",
  };
}

// Dual-role pick: alternate position by match index so each role gets played.
function pickDualPositionForJordan(matchIdx: number): Position {
  return matchIdx % 2 === 0 ? "RS" : "L";
}
function pickDualPositionForSam(matchIdx: number): Position {
  return matchIdx % 2 === 0 ? "L" : "S";
}

function makeStatLineForPlayer(
  player: SeedPlayer,
  matchIdx: number,
  bias: Bias,
): StatLineSeed {
  if (player.name === "Jordan") {
    const pos = pickDualPositionForJordan(matchIdx);
    return pos === "L" ? { ...makeLibero(bias), positionPlayed: "L" } : makeRS(bias);
  }
  if (player.name === "Sam") {
    const pos = pickDualPositionForSam(matchIdx);
    if (pos === "S") return { ...makeSetter(bias), positionPlayed: "S" };
    return { ...makeLibero(bias), positionPlayed: "L" };
  }
  switch (player.primaryPosition) {
    case "OH":
      return makeOH(bias);
    case "RS":
    case "OPP":
      return makeRS(bias);
    case "MB":
      return makeMB(bias);
    case "S":
      return makeSetter(bias);
    case "L":
    case "DS":
      return makeLibero(bias);
    default:
      return makeOH(bias);
  }
}


const PREVIEW_EMAIL = "brand-preview@spikeledger.app";
const PREVIEW_PASSWORD = randomBytes(12).toString("base64url");
const IDS_FILE = process.env.PREVIEW_IDS ?? "/tmp/spikeledger-landing-preview.json";

const ROSTER_14U: SeedPlayer[] = [
  { name: "Ava", number: 4, primaryPosition: "OH" },
  { name: "Chloe", number: 9, primaryPosition: "OH" },
  { name: "Sofia", number: 7, primaryPosition: "RS" },
  { name: "Emma", number: 11, primaryPosition: "RS" },
  { name: "Harper", number: 3, primaryPosition: "MB" },
  { name: "Lily", number: 1, primaryPosition: "S" },
  { name: "Grace", number: 8, primaryPosition: "MB" },
  { name: "Zoe", number: 12, primaryPosition: "MB" },
  { name: "Ella", number: 5, primaryPosition: "L" },
  { name: "Mia", number: 10, primaryPosition: "S" },
  { name: "Nora", number: 2, primaryPosition: "L" },
];
const ROSTER_18U: SeedPlayer[] = [
  { name: "Taylor", number: 7, primaryPosition: "OH" },
  { name: "Brooke", number: 12, primaryPosition: "OH" },
  { name: "Sydney", number: 8, primaryPosition: "RS" },
  { name: "Jasmine", number: 11, primaryPosition: "OPP" },
  { name: "Kayla", number: 3, primaryPosition: "MB" },
  { name: "Alexis", number: 1, primaryPosition: "S" },
  { name: "Paige", number: 9, primaryPosition: "MB" },
  { name: "Hannah", number: 4, primaryPosition: "MB" },
  { name: "Rachel", number: 5, primaryPosition: "L" },
  { name: "Olivia", number: 10, primaryPosition: "S" },
  { name: "Megan", number: 2, primaryPosition: "DS" },
  { name: "Erin", number: 6, primaryPosition: "OH" },
];

interface PreviewTournament {
  name: string;
  startDate: Date;
  endDate: Date;
  location: string;
  results: MatchResult[];
  errorBias: number;
  killBias: number;
  opponentOffset: number;
}
const W = MatchResult.WIN, L = MatchResult.LOSS;
const TEAMS: { name: string; ageGroup: string; roster: SeedPlayer[]; tournaments: PreviewTournament[] }[] = [
  {
    name: "Lakeshore Storm 16U", ageGroup: "16U", roster: ROSTER,
    tournaments: [
      { name: "Fall Kickoff Classic", startDate: new Date("2025-11-15"), endDate: new Date("2025-11-16"), location: "Etobicoke Olympium", results: [L, W, L, L], errorBias: 1, killBias: 0, opponentOffset: 0 },
      { name: "Winter Invitational", startDate: new Date("2025-12-06"), endDate: new Date("2025-12-07"), location: "Markham Pan Am Centre", results: [W, L, W, L], errorBias: 0, killBias: 0, opponentOffset: 1 },
      { name: "New Year Qualifier", startDate: new Date("2026-01-09"), endDate: new Date("2026-01-10"), location: "Toronto Pan Am Sports Centre", results: [W, W, L, W], errorBias: -1, killBias: 1, opponentOffset: 2 },
    ],
  },
  {
    name: "Lakeshore Storm 14U", ageGroup: "14U", roster: ROSTER_14U,
    tournaments: [
      { name: "Fall Kickoff Classic", startDate: new Date("2025-11-21"), endDate: new Date("2025-11-22"), location: "Etobicoke Olympium", results: [L, L, W, L], errorBias: 1, killBias: -1, opponentOffset: 1 },
    ],
  },
  {
    name: "Lakeshore Storm 18U", ageGroup: "18U", roster: ROSTER_18U,
    tournaments: [
      { name: "Winter Invitational", startDate: new Date("2025-12-13"), endDate: new Date("2025-12-14"), location: "Markham Pan Am Centre", results: [W, W, L, W], errorBias: 0, killBias: 1, opponentOffset: 2 },
      { name: "New Year Qualifier", startDate: new Date("2026-01-16"), endDate: new Date("2026-01-17"), location: "Toronto Pan Am Sports Centre", results: [L, W, W, L], errorBias: 0, killBias: 0, opponentOffset: 3 },
    ],
  },
];

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: PREVIEW_EMAIL } });
  if (existing) {
    console.log("preview coach exists - deleting (teams, matches and stats cascade)");
    await prisma.user.delete({ where: { id: existing.id } });
  }
  if (process.argv.includes("--delete")) {
    console.log(existing ? "deleted" : "nothing to delete");
    return;
  }
  const passwordHash = await bcrypt.hash(PREVIEW_PASSWORD, 10);
  const coach = await prisma.user.create({
    data: { email: PREVIEW_EMAIL, name: "Morgan Reyes", passwordHash, plan: "COACH_PRO" },
  });
  const out: { email: string; password: string; userId: string; teams: unknown[] } = {
    email: PREVIEW_EMAIL, password: PREVIEW_PASSWORD, userId: coach.id, teams: [],
  };
  for (const t of TEAMS) {
    const team = await prisma.team.create({
      data: { name: t.name, ageGroup: t.ageGroup, season: "2025-2026", coachId: coach.id },
    });
    const players = [];
    for (const p of t.roster) {
      players.push(await prisma.player.create({
        data: { teamId: team.id, name: p.name, number: p.number, primaryPosition: p.primaryPosition, secondaryPosition: p.secondaryPosition ?? null },
      }));
    }
    const playerByName = new Map(players.map((p) => [p.name, p]));
    const tournamentsOut = [];
    for (const tt of t.tournaments) {
      const tournament = await prisma.tournament.create({
        data: { teamId: team.id, name: tt.name, startDate: tt.startDate, endDate: tt.endDate, location: tt.location },
      });
      const matchesOut = [];
      for (let i = 0; i < tt.results.length; i++) {
        const result = tt.results[i];
        const setsWon = result === "WIN" ? (rand() < 0.5 ? 2 : 3) : rand() < 0.5 ? 0 : 1;
        const setsLost = result === "WIN" ? (setsWon === 2 ? ri(0, 1) : 2) : rand() < 0.5 ? 2 : 3;
        const opponent = OPPONENTS[(i + tt.opponentOffset) % OPPONENTS.length];
        const match = await prisma.match.create({
          data: { tournamentId: tournament.id, opponent, matchNumber: i + 1, setsWon, setsLost, result },
        });
        const bias: Bias = { errorBias: tt.errorBias, killBias: tt.killBias };
        for (const seedPlayer of t.roster) {
          const dbPlayer = playerByName.get(seedPlayer.name);
          if (!dbPlayer) continue;
          const line = makeStatLineForPlayer(seedPlayer, i, bias);
          await prisma.statLine.create({ data: { matchId: match.id, playerId: dbPlayer.id, ...line } });
        }
        matchesOut.push({ id: match.id, opponent, matchNumber: i + 1 });
      }
      tournamentsOut.push({ id: tournament.id, name: tt.name, matches: matchesOut });
    }
    out.teams.push({
      id: team.id, name: t.name,
      players: players.map((p) => ({ id: p.id, name: p.name, number: p.number, position: p.primaryPosition })),
      tournaments: tournamentsOut,
    });
    console.log(`${t.name}: ${players.length} players, ${t.tournaments.length} tournaments`);
  }
  writeFileSync(IDS_FILE, JSON.stringify(out, null, 2));
  console.log("ids + password written to", IDS_FILE);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
