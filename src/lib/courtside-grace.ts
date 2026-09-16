// Never stop a coach who is standing in a gym.
//
// A free coach who hits the tournament limit with players warming up does not
// reach for a credit card. They put the phone away, score the day on paper,
// and do not come back. So the free tier gives way at exactly the moments that
// would cost us the coach, and holds firm everywhere else:
//
//   1. Stat entry is never blocked. Not for the plan, not for anything. The
//      courtside routes carry no plan check at all, and there is a test that
//      fails if one is ever added.
//   2. The third tournament is the last free one, and the coach is told so
//      when they make it, while there is still time to decide.
//   3. The fourth is allowed once as a courtesy, with a banner saying it is
//      the last one. That is recorded on the user, so it happens once.
//   4. After that the limit applies, and it applies at tournament creation:
//      a quiet moment at a laptop, never mid-match.
//
// Report cards follow the same rule: nothing to do with billing interrupts a
// match that is being scored.

import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, canUserPerformAction, type UpgradeReason } from "@/lib/plan-limits";

export const LAST_FREE_TOURNAMENT_NOTICE =
  "That was your last free tournament. Upgrade before your next one to keep tracking.";

export const GRACE_TOURNAMENT_BANNER =
  "This is a free courtesy tournament. Upgrade to keep going after this one.";

// A match counts as in progress while the coach has started it and not ended
// it. Same 24 hour window the parent live view uses, so an abandoned match
// cannot hold the door open forever.
const IN_PROGRESS_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function teamHasMatchInProgress(teamId: string): Promise<boolean> {
  const match = await prisma.match.findFirst({
    where: {
      tournament: { teamId },
      result: null,
      startedAt: { gte: new Date(Date.now() - IN_PROGRESS_WINDOW_MS) },
    },
    select: { id: true },
  });
  return Boolean(match);
}

export interface TournamentDecision {
  allow: boolean;
  // True when this one is only allowed because of the courtesy grace.
  grace: boolean;
  // Shown after a successful create, when this was the last free one.
  notice: string | null;
  reason: UpgradeReason | null;
  // Why it was allowed, for logs and tests.
  because: "within-limit" | "grace" | "match-in-progress" | "blocked";
}

// Decides whether a tournament may be created, and says why. Does not write:
// the caller records the grace only once the tournament actually exists.
export async function decideTournamentCreation(
  userId: string,
  teamId: string,
  plan: Plan,
): Promise<TournamentDecision> {
  const existing = await prisma.tournament.count({ where: { teamId } });
  const check = canUserPerformAction(plan, "add-tournament", {
    currentTournamentCount: existing,
  });

  if (check.allowed) {
    const limit = PLAN_LIMITS[plan].maxTournamentsPerTeam;
    // The one being created now takes the count to `existing + 1`.
    const isLastFree = Number.isFinite(limit) && existing + 1 >= limit;
    return {
      allow: true,
      grace: false,
      notice: isLastFree ? LAST_FREE_TOURNAMENT_NOTICE : null,
      reason: null,
      because: "within-limit",
    };
  }

  // Over the limit. Two ways through, and both are deliberate.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { graceTournamentUsedAt: true },
  });

  if (!user?.graceTournamentUsedAt) {
    return { allow: true, grace: true, notice: null, reason: null, because: "grace" };
  }

  // The grace is spent. One last exception: a match is being scored right now,
  // and a paywall must never appear in the middle of one.
  if (await teamHasMatchInProgress(teamId)) {
    return { allow: true, grace: false, notice: null, reason: null, because: "match-in-progress" };
  }

  return {
    allow: false,
    grace: false,
    notice: null,
    reason: check.reason ?? null,
    because: "blocked",
  };
}

// Records that the courtesy tournament has been used, pinned to the row that
// was just created so its page can carry the banner.
export async function recordGraceTournament(userId: string, tournamentId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { graceTournamentId: tournamentId, graceTournamentUsedAt: new Date() },
  });
}

export async function isGraceTournament(userId: string, tournamentId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { graceTournamentId: true },
  });
  return user?.graceTournamentId === tournamentId;
}
