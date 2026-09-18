import { POSITION_LABELS } from "@/lib/positions";
import type {
  PlayerInsightRequest,
  TeamInsightRequest,
} from "./types";
import {
  UNIVERSAL_GUIDANCE,
  drillsForPosition,
  drillsForUniversal,
  parseAgeGroup,
  renderBenchmarks,
  renderDrillList,
  renderFrameworkFull,
  renderUniversalBenchmarks,
  renderUniversalFramework,
} from "./volleyball-knowledge";

export const POSITION_GUIDANCE = {
  libero_ds:
    "Libero/DS: focus on passing (SR), defense (digs), serve consistency. NEVER mention hitting or blocking - liberos don't attack or play at the net.",
  hitter:
    "Hitter (OH/RS/OPP): focus on hitting efficiency, kill rate, serve receive, serving, attack errors. Blocking is team-strategy dependent - only mention if blocks/match is unusually high or low.",
  setter:
    "Setter (S): focus on assists/distribution, setting consistency, decision-making, serve consistency, and blocking presence when front-row. Setters are NOT in serve receive - never mention SR/passing as their job.",
  middle:
    "Middle Blocker (MB): focus on blocking presence (blocks/match), quick-attack efficiency (kills/match, hitting %), serve consistency, and transition attacking. Middle Blockers do NOT set - NEVER mention assists or distribution. They are not in serve receive - never mention SR.",
};

export const PLAYER_SYSTEM_PROMPT = `You are a specialist volleyball coaching analyst. You have a curated database of proven drills and age-appropriate benchmarks for competitive volleyball. You evaluate players using the Bank Account system and recommend specific drills from your database. You never make up drill names. You coach youth athletes with a development-first approach - lead with strengths, and name growth areas as things to work on, and always tie advice to specific, actionable practice activities.

RULES - read each carefully and follow exactly:
1. ALWAYS reference actual numbers from the data. Do not invent stats.
2. Every improvement MUST prescribe a drill taken from the AVAILABLE DRILLS list in the user message - use the drill's exact name and copy its youtubeQuery verbatim. NEVER invent a drill or a search phrase. Fill EVERY drill field:
   - drill: the database drill's exact name + one sentence on how it is run.
   - duration: exact time per practice, based on the drill's listed minutes (e.g. "10 minutes per practice").
   - reps: number of reps or sets (e.g. "30 reps each" or "3 sets of 10").
   - players: how many players are needed, based on the drill's listed count (e.g. "3 players" or "whole team").
   - equipment: gear needed, or "None" (e.g. "1 ball, net").
   - youtubeQuery: copied EXACTLY from the chosen drill's youtubeQuery in the list. NO URLs, NO video IDs, NO links.
   Vague advice is unacceptable.
2b. Compare the player's stats against the AGE-GROUP BENCHMARKS in the user message and say plainly whether each key stat is developing, solid, or elite for their age group (note: serve error % and errors/match are better when LOWER). Use the benchmark's "solid" tier as the targetValue when setting improvement targets.
3. Be encouraging and honest. These are youth athletes, and they read this themselves. Name growth areas as the next thing to work on. Never describe a player as hurting, weak, poor or failing, and never call a player a problem.
3a. NEVER mention playing time. No sets played, no matches or games played, no appearances, no time on court, no starting or not starting, no substitutions, no benching, and no counts of any of those. A parent reads this, and playing time is between the parent and the coach, not something this app comments on. Write about what the player did, never about how much they were on the court.
4. NEVER suggest improvements for stats inappropriate to the player's position. Setters and Middle Blockers are DIFFERENT positions with different jobs - do not give one the other's advice. Position guidance:
   - ${POSITION_GUIDANCE.libero_ds}
   - ${POSITION_GUIDANCE.hitter}
   - ${POSITION_GUIDANCE.setter}
   - ${POSITION_GUIDANCE.middle}
5. Address the player by name in summary and parentFriendly.
6. Keep all text concise - coaches read these on phones. Each field ≤ 2 sentences except improvements.
7. The parentFriendly summary uses plain English (no volleyball jargon like "SR" or "kill efficiency"). Translate.
8. Respond ONLY with valid JSON matching the schema. No markdown fences, no preamble, no explanation outside the JSON.

SCHEMA (exact field names and types):
{
  "summary": "1-2 sentence performance overview, references concrete numbers",
  "strengths": ["2 to 3 concrete strengths, each ≤ 15 words"],
  "improvements": [
    {
      "area": "Stat/skill name, e.g. 'Serve receive'",
      "currentValue": "current number or percentage from the data",
      "targetValue": "realistic next-step target",
      "drill": "Named drill + one sentence on how to run it",
      "duration": "Exact time per practice, e.g. '10 minutes per practice'",
      "reps": "Reps or sets, e.g. '30 reps each' or '3 sets of 10'",
      "players": "Players needed, e.g. '3 players' or 'whole team'",
      "equipment": "Gear needed or 'None', e.g. '1 ball, net'",
      "youtubeQuery": "2-5 word drill search phrase, no 'volleyball', no URLs, e.g. 'triangle passing drill'",
      "explanation": "Why this matters and how the drill helps (≤ 25 words)"
    }
  ],
  "coachingNote": "1-2 sentence tactical suggestion for the coach (rotation, set selection, etc.)",
  "parentFriendly": "Plain-English 2-3 sentence summary a parent who has never played volleyball would understand"
}

Provide 2-3 strengths and 2-3 improvements. Always exactly those counts.`;

const TEAM_SYSTEM_PROMPT = `You are a specialist volleyball coaching analyst with a curated database of age-appropriate benchmarks for competitive volleyball. You analyze team performance for a youth team and write 3-4 concise, data-grounded insights, comparing players to the benchmarks for their age group where relevant.

RULES:
1. Reference actual numbers from the data (specific players, exact stat changes, tournament results).
2. Each insight stands alone - 1-2 sentences.
3. Mix performance description with tactical suggestion when applicable.
4. Position-fair: comparisons stay within position group when comparing players.
5. Encouraging and honest. Name what is working and what the team should work on next. Never describe a player as hurting, weak, poor or failing.
5a. Never comment on playing time, substitutions, who started, or how many sets or matches anyone played.
6. Respond ONLY as a JSON array of strings. No markdown, no preamble, no surrounding object. Example:
   ["First insight referencing concrete numbers.", "Second insight…", "Third insight…"]
`;

// Counts of participation never go into a prompt. The parent-facing sentence
// the model writes is rendered on the parent page, so anything it can see it
// can repeat, and "across 8 matches" is a playing time total. These fields
// stay on the request because the rule engine uses them as gates; they just
// do not get shown to the model.
const PLAYING_TIME_FIELDS = new Set(["matchesPlayed", "setsPlayed", "gamesPlayed"]);

function statBlock(stats: Record<string, number>): string {
  return Object.entries(stats)
    .filter(([k]) => !PLAYING_TIME_FIELDS.has(k))
    .map(([k, v]) => `  ${k}: ${typeof v === "number" ? v.toFixed(2).replace(/\.00$/, "") : v}`)
    .join("\n");
}

export function buildPlayerUserPrompt(req: PlayerInsightRequest): string {
  const lines: string[] = [];
  lines.push(`Analyze this player's performance.`);
  lines.push(``);
  const universal = req.usesPositions === false;
  lines.push(`Player: ${req.player.name}`);
  if (universal) {
    lines.push(`Position: none - ${UNIVERSAL_GUIDANCE}`);
    lines.push(
      `NOTE: Rule 4 (position restrictions) does NOT apply to this player. Treat them as a developing all-around player and recommend whichever skill the numbers point to next.`,
    );
  } else {
    lines.push(`Position: ${POSITION_LABELS[req.player.position]}`);
  }
  lines.push(`Scope: ${req.scopeLabel}`);
  lines.push(``);
  lines.push(universal ? `Stats (all-around):` : `Stats (position-appropriate):`);
  lines.push(statBlock(req.stats));
  lines.push(``);
  lines.push(
    `Bank Account: ${req.bankAccount.balance >= 0 ? "+" : ""}${req.bankAccount.balance} (${req.bankAccount.rating} - ${req.bankAccount.ratingLabel})`,
  );
  lines.push(
    `  Deposits: ${req.bankAccount.deposits} - ${Object.entries(req.bankAccount.depositBreakdown)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ") || "none"}`,
  );
  lines.push(
    `  Withdrawals: ${req.bankAccount.withdrawals} - ${Object.entries(req.bankAccount.withdrawalBreakdown)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ") || "none"}`,
  );

  if (req.trend && req.trend.length > 1) {
    lines.push(``);
    lines.push(`Trend across tournaments:`);
    for (const t of req.trend) {
      lines.push(
        `  ${t.scopeLabel}: Bank ${t.bankAccount.balance >= 0 ? "+" : ""}${t.bankAccount.balance} (${t.bankAccount.rating}) - ${Object.entries(
          t.stats,
        )
          .filter(([k]) => !PLAYING_TIME_FIELDS.has(k))
          .map(([k, v]) => `${k} ${v.toFixed(2).replace(/\.00$/, "")}`)
          .join(", ")}`,
      );
    }
  }

  if (req.teamContext) {
    lines.push(``);
    lines.push(
      `Team Context: ${req.teamContext.teamName} record ${req.teamContext.record}.`,
    );
    lines.push(`Team averages:`);
    lines.push(statBlock(req.teamContext.avgStats));
  }

  // Knowledge-base context: benchmarks + framework + the only drills the
  // model is allowed to recommend (filtered to this player's position).
  const age = parseAgeGroup(req.ageGroup);
  lines.push(``);
  if (universal) {
    lines.push(`AGE-GROUP BENCHMARKS (${age}, all-around) - developing / solid / elite:`);
    lines.push(renderUniversalBenchmarks(age));
    lines.push(``);
    lines.push(`ALL-AROUND COACHING FRAMEWORK (no set positions):`);
    lines.push(renderUniversalFramework());
    lines.push(``);
    lines.push(`AVAILABLE DRILLS (recommend ONLY these; copy name and youtubeQuery exactly):`);
    lines.push(renderDrillList(drillsForUniversal(age)));
  } else {
    lines.push(`AGE-GROUP BENCHMARKS (${age}, ${req.player.position}) - developing / solid / elite:`);
    lines.push(renderBenchmarks(req.player.position, age));
    lines.push(``);
    lines.push(`POSITION COACHING FRAMEWORK (${POSITION_LABELS[req.player.position]}):`);
    lines.push(renderFrameworkFull(req.player.position));
    lines.push(``);
    lines.push(`AVAILABLE DRILLS for this position (recommend ONLY these; copy name and youtubeQuery exactly):`);
    lines.push(renderDrillList(drillsForPosition(req.player.position)));
  }

  lines.push(``);
  lines.push(`Generate coaching insights as JSON matching the schema exactly.`);
  return lines.join("\n");
}

export function buildTeamSystemPrompt(): string {
  return TEAM_SYSTEM_PROMPT;
}

export function buildTeamUserPrompt(req: TeamInsightRequest): string {
  const lines: string[] = [];
  lines.push(`Analyze this volleyball team's performance.`);
  lines.push(``);
  const universal = req.usesPositions === false;
  lines.push(`Team: ${req.team.name}`);
  lines.push(`Record: ${req.record}`);
  lines.push(`Scope: ${req.scopeLabel}`);
  if (universal) {
    lines.push(`Positions: none - ${UNIVERSAL_GUIDANCE} Rule 4 (position-fair grouping) does not apply; compare all players on the same all-around metrics.`);
  }
  lines.push(``);
  if (req.tournamentTrend.length > 0) {
    lines.push(`Tournament-by-tournament:`);
    for (const t of req.tournamentTrend) {
      lines.push(
        `  ${t.name} (${t.record}): net ${t.netProduction >= 0 ? "+" : ""}${t.netProduction} · SR avg ${t.srAverage.toFixed(2)} · ${t.kills}K / ${t.errors}E`,
      );
    }
    lines.push(``);
  }
  lines.push(`Player Bank Accounts (this scope):`);
  for (const p of req.playerBankAccounts) {
    lines.push(
      `  ${p.name}${universal ? "" : ` (${p.position})`}: ${p.balance >= 0 ? "+" : ""}${p.balance} ${p.rating}`,
    );
  }

  // Benchmarks for the positions actually on this roster.
  const age = parseAgeGroup(req.ageGroup);
  const positions = [...new Set(req.playerBankAccounts.map((p) => p.position))];
  if (universal) {
    lines.push(``);
    lines.push(`AGE-GROUP BENCHMARKS (${age}, all-around) - developing / solid / elite:`);
    lines.push(renderUniversalBenchmarks(age));
  } else if (positions.length > 0) {
    lines.push(``);
    lines.push(`AGE-GROUP BENCHMARKS (${age}) - developing / solid / elite:`);
    for (const pos of positions) {
      lines.push(`${pos}:`);
      lines.push(renderBenchmarks(pos, age));
    }
  }

  lines.push(``);
  lines.push(
    `Produce 3-4 specific, data-grounded insights as a JSON array of strings.`,
  );
  return lines.join("\n");
}
