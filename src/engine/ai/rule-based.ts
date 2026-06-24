// Always-available fallback when neither Ollama nor Google is reachable.
// Same shape as the LLM responses so callers don't have to branch.

import { POSITION_GROUP, POSITION_LABELS } from "@/lib/positions";
import { fmtNum, fmtPct } from "@/engine/derived-stats";
import { computeImprovementAreas } from "@/components/reports/utils/improvement-rules";
import type { Position } from "@prisma/client";
import type {
  PlayerInsightRequest,
  PlayerInsightResponse,
  TeamInsightRequest,
  TeamInsightResponse,
  ImprovementInsight,
} from "./types";

function strengthsFor(req: PlayerInsightRequest): string[] {
  const out: string[] = [];
  const s = req.stats;
  const ba = req.bankAccount;
  // Use the four-way split (hitter/middle/setter/libero) so setters and
  // middles never trade strengths - middles don't set, setters don't get
  // credited for a middle's job.
  const group = POSITION_GROUP[req.player.position];

  if (ba.rating === "GREEN") {
    out.push(
      `Bank Account ${ba.balance >= 0 ? "+" : ""}${ba.balance} (${ba.ratingLabel}) - ${(ba.ratio * 100).toFixed(0)}% of contributions are deposits.`,
    );
  } else if (ba.rating === "BLUE") {
    out.push(
      `Steady contributor: Bank Account ${ba.balance >= 0 ? "+" : ""}${ba.balance} this scope.`,
    );
  }
  if (group === "libero" && s.srAverage !== undefined && s.srAverage >= 1.8) {
    out.push(`Reliable passing - SR average ${s.srAverage.toFixed(2)} keeps the offense in system.`);
  }
  if (
    (group === "hitter" || group === "middle") &&
    s.hittingEfficiency !== undefined &&
    s.hittingEfficiency >= 0.15
  ) {
    out.push(
      `Efficient swings - hitting ${fmtPct(s.hittingEfficiency, 1)} this scope.`,
    );
  }
  // Distribution is a setter strength only - middles do not set.
  if (group === "setter" && s.assistsPerMatch !== undefined && s.assistsPerMatch >= 8) {
    out.push(
      `Strong distribution - ${fmtNum(s.assistsPerMatch, 1)} assists per match.`,
    );
  }
  if (
    (group === "setter" || group === "middle") &&
    s.blocksPerMatch !== undefined &&
    s.blocksPerMatch >= 1.0
  ) {
    out.push(
      `Active at the net - ${fmtNum(s.blocksPerMatch, 1)} blocks per match.`,
    );
  }
  if (s.acesPerMatch !== undefined && s.acesPerMatch >= 1.5) {
    out.push(
      `Tough server: ${fmtNum(s.acesPerMatch, 1)} aces/match keeps opponents off-balance.`,
    );
  }
  if (out.length === 0) out.push(`Showing up and contributing - this is the floor to build from.`);
  return out.slice(0, 3);
}

function buildImprovements(req: PlayerInsightRequest): ImprovementInsight[] {
  // Re-use the Phase 4 rule engine and map ImprovementArea → ImprovementInsight.
  const areas = computeImprovementAreas(
    {
      // The rule engine works off a DerivedStats-shaped object; we only need the
      // fields the rules actually read. Cast through unknown since the source
      // request carries the same numbers under direct keys.
      ...(req.stats as Record<string, number>),
      // These are the names computeImprovementAreas expects.
      srAverage: req.stats.srAverage ?? 0,
      srTotal: req.stats.srTotal ?? 0,
      perfectPassPercentage: req.stats.perfectPassPercentage ?? 0,
      hittingEfficiency: req.stats.hittingEfficiency ?? 0,
      killsPerMatch: req.stats.killsPerMatch ?? 0,
      totalKills: req.stats.totalKills ?? 0,
      totalAttackErrors: req.stats.totalAttackErrors ?? 0,
      acesPerMatch: req.stats.acesPerMatch ?? 0,
      totalAces: req.stats.totalAces ?? 0,
      totalServeErrors: req.stats.totalServeErrors ?? 0,
      serveErrorPercentage: req.stats.serveErrorPercentage ?? 0,
      blocksPerMatch: req.stats.blocksPerMatch ?? 0,
      assistsPerMatch: req.stats.assistsPerMatch ?? 0,
      digsPerMatch: req.stats.digsPerMatch ?? 0,
      errorsPerMatch: req.stats.errorsPerMatch ?? 0,
      matchesPlayed: req.stats.matchesPlayed ?? 0,
      bankAccount: req.bankAccount,
    } as never,
    req.player.position as Position,
    req.player.name,
  );
  return areas.slice(0, 3).map((a) => ({
    area: a.metric,
    currentValue: a.current,
    targetValue: a.target,
    drill: a.detail,
    youtubeQuery: a.youtubeQuery,
    explanation:
      "A few focused reps every practice move this number fast, usually within a tournament or two.",
  }));
}

function parentFriendlyFor(req: PlayerInsightRequest): string {
  const ba = req.bankAccount;
  // Speak to the player's actual position, never the internal Bank Account
  // group - a Setter is "their setter role", not "their setting / middle role".
  const role = `their ${POSITION_LABELS[req.player.position].toLowerCase()} role`;
  const verdict =
    ba.rating === "GREEN"
      ? `having a strong run in ${role} this ${req.scopeLabel}.`
      : ba.rating === "BLUE"
        ? `holding their own in ${role} this ${req.scopeLabel}.`
        : ba.rating === "ORANGE"
          ? `working through some growing pains in ${role} this ${req.scopeLabel}.`
          : ba.rating === "RED"
            ? `having a tough stretch in ${role} this ${req.scopeLabel} - every player has them.`
            : `still gathering stats in ${role}.`;
  return `${req.player.name} is ${verdict} They’re evaluated on what their position is supposed to do, not on everyone else’s stats - that’s the fair-comparison principle SpikeLedger is built on.`;
}

export function generateRuleBasedPlayerInsight(
  req: PlayerInsightRequest,
): PlayerInsightResponse {
  const summary = `${req.player.name} - Bank Account ${
    req.bankAccount.balance >= 0 ? "+" : ""
  }${req.bankAccount.balance} (${req.bankAccount.ratingLabel}) in ${req.scopeLabel}. ${
    req.bankAccount.deposits
  } deposits vs ${req.bankAccount.withdrawals} withdrawals.`;

  const group = POSITION_GROUP[req.player.position];
  const coachingNote =
    group === "libero"
      ? "Lean on this player as the floor anchor - get them more reps in serve receive rotations 1 and 6."
      : group === "setter"
        ? "Reward clean first balls by speeding up tempo - run your middle on a quick when this setter is in system."
        : group === "middle"
          ? "Feed this middle more first-tempo sets and slides - net touches turn into blocks and quick kills."
          : "Run a quick attack ahead of this player's outside set to soften the block.";

  return {
    summary,
    strengths: strengthsFor(req),
    improvements: buildImprovements(req),
    coachingNote,
    parentFriendly: parentFriendlyFor(req),
    provider: "rule-based",
    cached: false,
    generatedAt: new Date().toISOString(),
  };
}

export function generateRuleBasedTeamInsight(
  req: TeamInsightRequest,
): TeamInsightResponse {
  const insights: string[] = [];
  const trend = req.tournamentTrend;
  if (trend.length >= 2) {
    const first = trend[0];
    const last = trend[trend.length - 1];
    const delta = last.netProduction - first.netProduction;
    insights.push(
      `Net production moved from ${first.netProduction >= 0 ? "+" : ""}${first.netProduction} in ${first.name} to ${last.netProduction >= 0 ? "+" : ""}${last.netProduction} in ${last.name} (Δ${delta >= 0 ? "+" : ""}${delta}).`,
    );
    const srDelta = last.srAverage - first.srAverage;
    if (Math.abs(srDelta) > 0.05) {
      insights.push(
        `Team passing ${srDelta > 0 ? "improved" : "regressed"}: SR avg ${first.srAverage.toFixed(2)} → ${last.srAverage.toFixed(2)}.`,
      );
    }
  }
  const sorted = [...req.playerBankAccounts].sort((a, b) => b.balance - a.balance);
  if (sorted.length > 0) {
    const top = sorted[0];
    insights.push(
      `${top.name} (${top.position}) leads the Bank Account at ${top.balance >= 0 ? "+" : ""}${top.balance} (${top.rating}) - give them the high-pressure rotations.`,
    );
  }
  if (sorted.length >= 4) {
    const bottom = sorted[sorted.length - 1];
    if (bottom.balance < 0) {
      insights.push(
        `${bottom.name} (${bottom.position}) sits at ${bottom.balance} this scope - a focused one-on-one this week could move the team total fast.`,
      );
    }
  }
  if (insights.length === 0) {
    insights.push(
      `Log more matches to surface trends - the Bank Account becomes more useful as the sample size grows.`,
    );
  }
  return {
    insights: insights.slice(0, 4),
    provider: "rule-based",
    cached: false,
    generatedAt: new Date().toISOString(),
  };
}
