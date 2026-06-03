import { PrismaClient, Position, MatchResult } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

// Route the seed script through Neon's WebSocket pool too, so it works from
// networks that block port 5432.
neonConfig.webSocketConstructor = ws;
const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaNeon(_pool) });

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
  "Durham Attack",
  "Pakmen",
  "Ontario Volleyball",
  "Halton Hurricanes",
  "Niagara Rapids",
  "Mississauga Pakmen",
  "Leaside Storm",
  "Toronto West",
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

// ---------------------------------------------------------------------------
// Main seeding routine - wiped on each run for idempotency.
// ---------------------------------------------------------------------------
async function main() {
  console.log("Resetting database…");
  await prisma.statLine.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany({ where: { email: "demo@spikeledger.app" } });

  console.log("Creating demo coach…");
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const coach = await prisma.user.create({
    data: {
      email: "demo@spikeledger.app",
      name: "Demo Coach",
      passwordHash,
    },
  });

  console.log("Creating Thunder Hawks 16U…");
  const team = await prisma.team.create({
    data: {
      name: "Thunder Hawks 16U",
      ageGroup: "16U",
      season: "2025-2026",
      coachId: coach.id,
    },
  });

  console.log("Creating roster…");
  const players = await Promise.all(
    ROSTER.map((p) =>
      prisma.player.create({
        data: {
          teamId: team.id,
          name: p.name,
          number: p.number,
          primaryPosition: p.primaryPosition,
          secondaryPosition: p.secondaryPosition ?? null,
        },
      }),
    ),
  );
  const playerByName = new Map(players.map((p) => [p.name, p]));

  console.log("Creating tournaments, matches, and stat lines…");
  for (const t of TOURNAMENTS) {
    const tournament = await prisma.tournament.create({
      data: {
        teamId: team.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        location: t.location,
      },
    });

    for (let i = 0; i < t.results.length; i++) {
      const result = t.results[i];
      // realistic set scores
      const setsWon = result === "WIN" ? (rand() < 0.5 ? 2 : 3) : rand() < 0.5 ? 0 : 1;
      const setsLost = result === "WIN" ? (setsWon === 2 ? ri(0, 1) : 2) : rand() < 0.5 ? 2 : 3;
      const opponent = OPPONENTS[(i + TOURNAMENTS.indexOf(t)) % OPPONENTS.length];
      const match = await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          opponent,
          matchNumber: i + 1,
          setsWon,
          setsLost,
          result,
        },
      });

      const bias: Bias = { errorBias: t.errorBias, killBias: t.killBias };
      for (const seedPlayer of ROSTER) {
        const dbPlayer = playerByName.get(seedPlayer.name);
        if (!dbPlayer) continue;
        const line = makeStatLineForPlayer(seedPlayer, i, bias);
        await prisma.statLine.create({
          data: {
            matchId: match.id,
            playerId: dbPlayer.id,
            ...line,
          },
        });
      }
    }
  }

  console.log("\nSeed complete.");
  console.log("  Demo login: demo@spikeledger.app / demo1234");
  console.log(`  ${players.length} players · ${TOURNAMENTS.length} tournaments · ${TOURNAMENTS.length * 4} matches · ${TOURNAMENTS.length * 4 * ROSTER.length} stat lines`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
