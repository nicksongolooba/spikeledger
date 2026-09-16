// "Ask Coach AI" context builder. Loads EVERYTHING the team has recorded -
// roster, tournaments, matches, stat lines, derived stats, Bank Account
// standings - and renders it into the system prompt so Claude answers from
// real numbers instead of guessing. Chat answers are only as good as this
// data block, so it errs on the side of completeness over prompt size.

import { prisma } from "@/lib/prisma";
import type { Player, StatLine, Position } from "@prisma/client";
import {
  POSITION_GROUP_MAP,
  calculateAggregateBankAccount,
} from "@/engine/bank-account";
import { computeDerivedStats, fmtNum, fmtPct } from "@/engine/derived-stats";
import { POSITION_LABELS } from "@/lib/positions";
import { POSITION_GUIDANCE } from "./prompts";
import { statsForGroup, statsForUniversal } from "./request-builders";
import {
  DRILLS,
  UNIVERSAL_GUIDANCE,
  parseAgeGroup,
  renderBenchmarks,
  renderDrillList,
  renderFrameworksCondensed,
  renderPracticeTemplates,
  renderUniversalBenchmarks,
  renderUniversalFramework,
} from "./volleyball-knowledge";

export type ChatFocus =
  | { type: "team" }
  | { type: "tournament"; id: string }
  | { type: "player"; id: string }
  | { type: "match"; id: string };

export interface ChatContext {
  systemPrompt: string;
  sources: string[];
}

type LineWithMatch = StatLine & {
  match: {
    id: string;
    tournamentId: string;
    opponent: string;
    matchNumber: number;
    result: "WIN" | "LOSS" | "DRAW" | null;
  };
};

function mostPlayed(lines: StatLine[], fallback: Position): Position {
  const counts: Partial<Record<Position, number>> = {};
  for (const l of lines) {
    const p = (l.positionPlayed ?? fallback) as Position;
    counts[p] = (counts[p] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  )[0]?.[0];
  return (top as Position | undefined) ?? fallback;
}

function teamTotals(lines: StatLine[]) {
  let kills = 0;
  let errors = 0;
  let sr0 = 0,
    sr1 = 0,
    sr2 = 0,
    sr3 = 0;
  for (const s of lines) {
    if (s.didNotPlay) continue;
    kills += s.kills;
    errors += s.serveErrors + s.attackErrors + s.generalErrors + s.blockErrors;
    sr0 += s.sr0;
    sr1 += s.sr1;
    sr2 += s.sr2;
    sr3 += s.sr3;
  }
  const srAtt = sr0 + sr1 + sr2 + sr3;
  const srAverage = srAtt > 0 ? (sr1 + 2 * sr2 + 3 * sr3) / srAtt : 0;
  return { kills, errors, net: kills - errors, srAverage, srAttempts: srAtt };
}

// One compact stat row per player per match. The legend in the prompt
// explains the abbreviations once so the rows stay short.
function statRow(p: Player, s: StatLine, withPositions = true): string {
  if (s.didNotPlay) return `  ${p.name}: DNP`;
  const pos = (s.positionPlayed ?? p.primaryPosition) as Position;
  return (
    `  ${p.name}${withPositions ? ` (${pos})` : ""}: ` +
    `K${s.kills}/${s.attackErrors}e/${s.attackAttempts}att, ` +
    `serve A${s.aces}/${s.serveErrors}e/${s.serveAttempts}att, ` +
    `B${s.blocks}/${s.blockErrors}e, ` +
    `Ast${s.assists}/${s.settingErrors}e, ` +
    `SR ${s.sr0}-${s.sr1}-${s.sr2}-${s.sr3}, ` +
    `D${s.digs}, GE${s.generalErrors}, sets${s.setsPlayed}`
  );
}

function fmtStats(stats: Record<string, number>): string {
  return Object.entries(stats)
    .map(([k, v]) => {
      const isPct = /percentage|efficiency/i.test(k);
      return `${k}=${isPct ? fmtPct(v, 1) : fmtNum(v, 2)}`;
    })
    .join(", ");
}

export async function buildChatContext(
  team: {
    id: string;
    name: string;
    season: string | null;
    ageGroup: string | null;
    usesPositions?: boolean;
  },
  focus: ChatFocus,
): Promise<ChatContext> {
  const usesPositions = team.usesPositions ?? true;
  const mode = usesPositions ? "positions" : "universal";
  const [players, tournaments, statLines] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: team.id },
      orderBy: [{ number: "asc" }, { name: "asc" }],
    }),
    prisma.tournament.findMany({
      where: { teamId: team.id },
      orderBy: { startDate: "asc" },
      include: { matches: { orderBy: { matchNumber: "asc" } } },
    }),
    prisma.statLine.findMany({
      where: { match: { tournament: { teamId: team.id } } },
      include: {
        match: {
          select: {
            id: true,
            tournamentId: true,
            opponent: true,
            matchNumber: true,
            result: true,
          },
        },
      },
    }) as Promise<LineWithMatch[]>,
  ]);

  const playerById = new Map(players.map((p) => [p.id, p]));
  const linesByPlayer = new Map<string, LineWithMatch[]>();
  const linesByMatch = new Map<string, LineWithMatch[]>();
  for (const l of statLines) {
    (linesByPlayer.get(l.playerId) ?? linesByPlayer.set(l.playerId, []).get(l.playerId)!).push(l);
    (linesByMatch.get(l.matchId) ?? linesByMatch.set(l.matchId, []).get(l.matchId)!).push(l);
  }

  // --- Overall record ---
  let wins = 0;
  let losses = 0;
  for (const t of tournaments) {
    for (const m of t.matches) {
      if (m.result === "WIN") wins += 1;
      else if (m.result === "LOSS") losses += 1;
    }
  }

  // --- ROSTER ---
  const rosterBlock = players
    .map((p) => {
      const num = p.number !== null ? `#${p.number} ` : "";
      const secondary = p.secondaryPosition
        ? ` / secondary ${POSITION_LABELS[p.secondaryPosition]}`
        : "";
      const inactive = p.isActive ? "" : " (inactive)";
      if (!usesPositions) return `- ${num}${p.name}${inactive}`;
      return `- ${num}${p.name} - ${POSITION_LABELS[p.primaryPosition]} (${p.primaryPosition})${secondary}${inactive}`;
    })
    .join("\n");

  // --- TOURNAMENTS (with per-match results + per-player match stat rows) ---
  const tournamentBlocks = tournaments.map((t, idx) => {
    const tLines = statLines.filter((l) => l.match.tournamentId === t.id);
    const totals = teamTotals(tLines);
    const w = t.matches.filter((m) => m.result === "WIN").length;
    const l = t.matches.filter((m) => m.result === "LOSS").length;
    const date = t.startDate.toISOString().slice(0, 10);
    const matchBlocks = t.matches.map((m) => {
      const mLines = linesByMatch.get(m.id) ?? [];
      const mt = teamTotals(mLines);
      const rows = mLines
        .map((s) => {
          const p = playerById.get(s.playerId);
          return p ? statRow(p, s, usesPositions) : null;
        })
        .filter(Boolean)
        .join("\n");
      return (
        `Match ${m.matchNumber} vs ${m.opponent}: ${m.result ?? "no result"} ` +
        `(sets ${m.setsWon}-${m.setsLost}), team kills ${mt.kills}, team errors ${mt.errors}, ` +
        `team SR avg ${fmtNum(mt.srAverage, 2)}` +
        (rows ? `\n${rows}` : "")
      );
    });
    return (
      `Tournament ${idx + 1}: ${t.name} (${date}${t.location ? `, ${t.location}` : ""})\n` +
      `Record: ${w}-${l} | Kills ${totals.kills} | Errors ${totals.errors} | ` +
      `Net production ${totals.net} | Team SR avg ${fmtNum(totals.srAverage, 2)}\n` +
      matchBlocks.join("\n")
    );
  });

  // --- PLAYER SEASON STATS (derived + bank account + per-tournament trend) ---
  const playerBlocks: string[] = [];
  const standings: Array<{ name: string; pos: Position; balance: number; rating: string }> = [];
  for (const p of players) {
    const lines = linesByPlayer.get(p.id) ?? [];
    if (lines.length === 0) continue;
    const evaluatedAs = mostPlayed(lines, p.primaryPosition);
    const group = POSITION_GROUP_MAP[evaluatedAs];
    const derived = computeDerivedStats(lines, p.primaryPosition, mode);
    const stats = usesPositions ? statsForGroup(group, derived) : statsForUniversal(derived);
    const ba = derived.bankAccount;
    standings.push({
      name: p.name,
      pos: evaluatedAs,
      balance: ba.balance,
      rating: ba.ratingLabel,
    });
    const perTournament = tournaments
      .map((t) => {
        const tl = lines.filter((l) => l.match.tournamentId === t.id);
        if (tl.length === 0) return null;
        const tba = calculateAggregateBankAccount(tl, p.primaryPosition, mode);
        return `    ${t.name}: bank ${tba.balance >= 0 ? "+" : ""}${tba.balance} (${tba.ratingLabel})`;
      })
      .filter(Boolean)
      .join("\n");
    const who = usesPositions
      ? `${p.name} (${evaluatedAs}, plays as ${POSITION_LABELS[evaluatedAs]})`
      : `${p.name} (all-around)`;
    playerBlocks.push(
      `- ${who}: ${fmtStats(stats)}\n` +
        `    Season Bank Account: ${ba.balance >= 0 ? "+" : ""}${ba.balance} (${ba.ratingLabel})` +
        (perTournament ? `\n${perTournament}` : ""),
    );
  }

  // --- BANK ACCOUNT STANDINGS ---
  standings.sort((a, b) => b.balance - a.balance);
  const standingsBlock = standings
    .map(
      (s, i) =>
        `${i + 1}. ${s.name}${usesPositions ? ` (${s.pos})` : ""}: ${s.balance >= 0 ? "+" : ""}${s.balance} - ${s.rating}`,
    )
    .join("\n");

  // --- Focus note (context awareness for where the coach opened the chat) ---
  let focusNote = "";
  if (focus.type === "tournament") {
    const t = tournaments.find((x) => x.id === focus.id);
    if (t) {
      focusNote = `The coach opened this chat from the "${t.name}" tournament page. Prioritize that tournament's data unless asked about something else.`;
    }
  } else if (focus.type === "player") {
    const p = playerById.get(focus.id);
    if (p) {
      focusNote = `The coach is currently viewing ${p.name}'s profile. Focus on ${p.name} unless asked about something else.`;
    }
  } else if (focus.type === "match") {
    const line = statLines.find((l) => l.matchId === focus.id);
    const t = line ? tournaments.find((x) => x.id === line.match.tournamentId) : undefined;
    if (line) {
      focusNote = `The coach is currently reviewing Match ${line.match.matchNumber} vs ${line.match.opponent}${t ? ` at ${t.name}` : ""}. Focus on that match unless asked about something else.`;
    }
  }

  const dataBlock = `TEAM DATA:

Team: ${team.name}${team.ageGroup ? ` (${team.ageGroup})` : ""}
Season: ${team.season ?? "current"}
Record: ${wins}-${losses}
Positions: ${usesPositions ? "set positions (position-fair Bank Account)" : "none - everyone rotates through every position (universal Bank Account formula)"}

ROSTER (${players.length} players):
${rosterBlock || "(no players yet)"}

TOURNAMENTS (${tournaments.length}):
Per-player match rows use this legend: K kills/errors/attempts, serve A aces/errors/attempts, B blocks/errors, Ast assists/setting errors, SR is the 0-1-2-3 pass count (0=overpass/shank ... 3=perfect pass; SR average is out of 3), D digs, GE general errors, DNP did not play.
${tournamentBlocks.join("\n\n") || "(no tournaments yet)"}

PLAYER SEASON STATS:
${playerBlocks.join("\n") || "(no stats yet)"}

BANK ACCOUNT STANDINGS (season, highest balance first):
${standingsBlock || "(no stats yet)"}

Bank Account is SpikeLedger's plus/minus metric: points a player adds minus the ones they give back, judged against what their position is asked to do. Ratings: Strong contribution (green), Solid (blue), Building (orange), Focus area (red). Use those exact words for a rating; never invent harsher ones.`;

  // Coaching knowledge base: drills, age-group benchmarks for this team,
  // condensed position frameworks, and practice plan templates.
  const age = parseAgeGroup(team.ageGroup);
  const rosterPositions = [
    ...new Set(players.map((p) => p.primaryPosition)),
  ];
  const benchmarkBlock = usesPositions
    ? rosterPositions
        .map((pos) => `${pos} (${POSITION_LABELS[pos]}):\n${renderBenchmarks(pos, age)}`)
        .join("\n")
    : `All-around (no set positions):\n${renderUniversalBenchmarks(age)}`;
  const frameworkBlock = usesPositions
    ? renderFrameworksCondensed()
    : renderUniversalFramework();
  const knowledgeBlock = `COACHING KNOWLEDGE BASE:

DRILL DATABASE (the ONLY drills you may recommend - copy names and youtubeQuery values exactly):
${renderDrillList(DRILLS)}

AGE-GROUP BENCHMARKS for ${age} (developing / solid / elite; serve error % and errors/match are better LOWER):
${benchmarkBlock}

${usesPositions ? "POSITION FRAMEWORKS (condensed):" : "ALL-AROUND COACHING FRAMEWORK (this team has no set positions):"}
${frameworkBlock}

PRACTICE PLAN TEMPLATES (warmup 10 → skill block 15 → skill block 15 → team drill 20 → cooldown 5):
${renderPracticeTemplates()}`;

  const systemPrompt = `You are a specialist volleyball coaching analyst for SpikeLedger, talking to the head coach of a youth volleyball team. You have a curated database of proven drills and age-appropriate benchmarks for competitive volleyball, plus complete access to this team's data below. You evaluate players using the Bank Account system and recommend specific drills from your database. You never make up drill names. You coach youth athletes with a development-first approach - lead with strengths, and name growth areas as things to work on, and always tie advice to specific, actionable practice activities. Answer using ONLY the data provided. Be specific - actual numbers, actual player names, actual tournament results. Write like a fellow coach, not a corporate AI. Short, direct answers.

RULES:
1. ALWAYS ground claims in actual numbers from the data. NEVER invent or estimate stats that are not in the data. If the data can't answer the question, say so honestly.
2. ${usesPositions ? `Be position-aware. Never suggest a player work on a skill their position doesn't use:
   - ${POSITION_GUIDANCE.libero_ds}
   - ${POSITION_GUIDANCE.hitter}
   - ${POSITION_GUIDANCE.setter}
   - ${POSITION_GUIDANCE.middle}` : UNIVERSAL_GUIDANCE}
3. Keep responses concise: 2-4 short paragraphs max. No markdown headings or tables; hyphen lists and **bold** are fine.
4. Recommend drills ONLY from the DRILL DATABASE below. When you mention a drill, format it EXACTLY like this (one drill per block):
**Drill Name** (X players, X min, difficulty)
One sentence on how to run it.
One key coaching point.
[drill: <youtubeQuery copied exactly from the database>]
The [drill: ...] line becomes a video link in the app - plain words only, never a URL.
5. When the coach asks what a player or the team should work on, compare their stats to the AGE-GROUP BENCHMARKS and say plainly whether each relevant stat is developing, solid, or elite for ${age}. Target the "solid" tier next for developing stats.
6. When the coach asks for a practice plan, pick the best-matching PRACTICE PLAN TEMPLATE, keep its phase structure and minutes, and fill each phase with specific drills from the database - chosen and justified by THIS team's data (the benchmark areas furthest from target, rotation gaps, Bank Account withdrawals).
7. These are youth athletes, and they read what you write. Honest and constructive. Name growth areas as the next thing to work on, and never describe a player as hurting, weak, poor or failing.
8. For lineup/matchup questions, reason from the stats (SR average for serve-receive, hitting efficiency for attacking, Bank Account for overall reliability) and say which numbers drove the suggestion.
${focusNote ? `\nCONTEXT: ${focusNote}\n` : ""}
${dataBlock}

${knowledgeBlock}`;

  const sources = [
    `Roster (${players.length} players)`,
    `${tournaments.length} tournaments, ${tournaments.reduce((n, t) => n + t.matches.length, 0)} matches`,
    `${statLines.length} stat lines`,
    "Bank Account standings",
    `Drill database (${DRILLS.length} drills) + ${age} benchmarks`,
  ];
  if (focusNote) {
    sources.push(
      focus.type === "player"
        ? `Viewing: ${playerById.get((focus as { id: string }).id)?.name ?? "player"}`
        : focus.type === "tournament"
          ? `Viewing: ${tournaments.find((t) => t.id === (focus as { id: string }).id)?.name ?? "tournament"}`
          : "Viewing: match review",
    );
  }

  return { systemPrompt, sources };
}
