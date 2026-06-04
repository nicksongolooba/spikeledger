import { POSITION_LABELS } from "@/lib/positions";
import type {
  PlayerInsightRequest,
  TeamInsightRequest,
} from "./types";

const POSITION_GUIDANCE = {
  libero_ds:
    "Libero/DS: focus on passing (SR), defense (digs), serve consistency. NEVER mention hitting or blocking - liberos don't attack or play at the net.",
  hitter:
    "Hitter (OH/RS/OPP): focus on hitting efficiency, kill rate, serve receive, serving, attack errors. Blocking is team-strategy dependent - only mention if blocks/match is unusually high or low.",
  setter:
    "Setter (S): focus on assists/distribution, setting consistency, decision-making, serve consistency, and blocking presence when front-row. Setters are NOT in serve receive - never mention SR/passing as their job.",
  middle:
    "Middle Blocker (MB): focus on blocking presence (blocks/match), quick-attack efficiency (kills/match, hitting %), serve consistency, and transition attacking. Middle Blockers do NOT set - NEVER mention assists or distribution. They are not in serve receive - never mention SR.",
};

export const PLAYER_SYSTEM_PROMPT = `You are an experienced volleyball coach analyzing player statistics for a youth team (ages 14-18). You provide specific, data-driven coaching insights.

RULES - read each carefully and follow exactly:
1. ALWAYS reference actual numbers from the data. Do not invent stats.
2. Every improvement MUST prescribe a concrete, runnable drill. Fill EVERY drill field:
   - drill: a named drill + one sentence on how it is run (e.g. "Triangle Passing: one player serves, one passes, one targets; rotate every 10 reps").
   - duration: exact time per practice (e.g. "10 minutes per practice").
   - reps: number of reps or sets (e.g. "30 reps each" or "3 sets of 10").
   - players: how many players are needed (e.g. "3 players" or "whole team").
   - equipment: gear needed, or "None" (e.g. "1 ball, net").
   - youtubeQuery: 2-5 word search phrase for the drill, WITHOUT the word "volleyball" (the app prepends it). Plain words only - NO URLs, NO video IDs, NO links. Example: "triangle passing drill".
   Vague advice is unacceptable.
3. Be encouraging but honest. These are youth athletes. Frame weaknesses as growth opportunities, not failures.
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

const TEAM_SYSTEM_PROMPT = `You are an experienced volleyball coach analyzing team performance for a youth team. You write 3-4 concise, data-grounded insights.

RULES:
1. Reference actual numbers from the data (specific players, exact stat changes, tournament results).
2. Each insight stands alone - 1-2 sentences.
3. Mix performance description with tactical suggestion when applicable.
4. Position-fair: comparisons stay within position group when comparing players.
5. Encouraging but honest. Highlight both wins and structural problems.
6. Respond ONLY as a JSON array of strings. No markdown, no preamble, no surrounding object. Example:
   ["First insight referencing concrete numbers.", "Second insight…", "Third insight…"]
`;

function statBlock(stats: Record<string, number>): string {
  return Object.entries(stats)
    .map(([k, v]) => `  ${k}: ${typeof v === "number" ? v.toFixed(2).replace(/\.00$/, "") : v}`)
    .join("\n");
}

export function buildPlayerUserPrompt(req: PlayerInsightRequest): string {
  const lines: string[] = [];
  lines.push(`Analyze this player's performance.`);
  lines.push(``);
  lines.push(`Player: ${req.player.name}`);
  lines.push(`Position: ${POSITION_LABELS[req.player.position]}`);
  lines.push(`Scope: ${req.scopeLabel}`);
  lines.push(``);
  lines.push(`Stats (position-appropriate):`);
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
  lines.push(`Team: ${req.team.name}`);
  lines.push(`Record: ${req.record}`);
  lines.push(`Scope: ${req.scopeLabel}`);
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
      `  ${p.name} (${p.position}): ${p.balance >= 0 ? "+" : ""}${p.balance} ${p.rating}`,
    );
  }
  lines.push(``);
  lines.push(
    `Produce 3-4 specific, data-grounded insights as a JSON array of strings.`,
  );
  return lines.join("\n");
}
