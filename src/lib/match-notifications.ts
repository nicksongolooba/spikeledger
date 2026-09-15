// Match-start alerts for linked parents. Server only.
//
// When the coach confirms the starting lineup, every parent linked to a
// player in that lineup gets exactly one alert for the match, on exactly one
// channel:
//   - an active push subscription  -> web push only
//   - no push, or every push failed -> email only (if the parent allows it
//                                      and an email service is configured)
// A (match, parent) row is claimed before anything is sent, so a coach
// restarting or editing the match can never alert anyone twice, and the same
// claim enforces "at most one alert per parent per 10 minutes".

import { prisma } from "@/lib/prisma";
import { invalidateLive } from "@/lib/live-cache";
import { isAllowedPushEndpoint, pushConfigured, sendPush, type PushMessage, type PushResult, type PushTarget } from "@/lib/push";
import { appUrl, emailConfigured, matchStartEmail, matchStartTitle, sendEmail, type EmailResult, type OutgoingEmail } from "@/lib/email";

export const NOTIFY_RATE_WINDOW_MS = 10 * 60 * 1000;
export const APP_ICON = "/icons/icon-192.png";

export interface NotificationTransports {
  pushEnabled(): boolean;
  emailEnabled(): boolean;
  push(target: PushTarget, message: PushMessage): Promise<PushResult>;
  email(message: OutgoingEmail): Promise<EmailResult>;
}

export const defaultTransports: NotificationTransports = {
  pushEnabled: pushConfigured,
  emailEnabled: emailConfigured,
  push: sendPush,
  email: sendEmail,
};

export type ParentOutcome =
  | { parentId: string; result: "sent"; channel: "PUSH" | "EMAIL"; reason: string | null }
  | { parentId: string; result: "skipped"; reason: string }
  | { parentId: string; result: "failed"; reason: string }
  | { parentId: string; result: "duplicate" };

export interface NotifySummary {
  notified: number; // parents who got a push or an email
  push: number;
  email: number;
  skipped: number;
  failed: number;
  duplicates: number;
  reason: string | null; // why nobody was considered at all
  parents: ParentOutcome[];
}

function emptySummary(reason: string | null): NotifySummary {
  return { notified: 0, push: 0, email: 0, skipped: 0, failed: 0, duplicates: 0, reason, parents: [] };
}

export function matchStartPush(args: {
  names: string[];
  teamName: string;
  opponent: string;
  playerId: string;
  matchId: string;
}): PushMessage {
  return {
    title: matchStartTitle(args.names),
    body: `${args.teamName} vs ${args.opponent}. Tap to watch live.`,
    url: `/parent/player/${args.playerId}`,
    icon: APP_ICON,
    tag: `match-start-${args.matchId}`,
  };
}

type Claim = { id: string } | "duplicate" | "rate_limited";

// Serialised per parent with a transaction-scoped advisory lock, so two
// matches starting at the same moment can't both pass the 10-minute check.
async function claim(matchId: string, parentId: string, playerIds: string[]): Promise<Claim> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`match-alert:${parentId}`}))::text AS locked`;
    const existing = await tx.matchNotification.findUnique({
      where: { matchId_parentId: { matchId, parentId } },
      select: { id: true },
    });
    if (existing) return "duplicate" as const;
    const recent = await tx.matchNotification.findFirst({
      where: {
        parentId,
        status: { in: ["PENDING", "SENT"] },
        createdAt: { gt: new Date(Date.now() - NOTIFY_RATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) {
      await tx.matchNotification.create({
        data: { matchId, parentId, playerIds, status: "SKIPPED", reason: "rate_limited" },
      });
      return "rate_limited" as const;
    }
    return tx.matchNotification.create({
      data: { matchId, parentId, playerIds, status: "PENDING" },
      select: { id: true },
    });
  });
}

interface ParentTarget {
  id: string;
  email: string;
  emailMatchAlerts: boolean;
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[];
  children: { id: string; name: string }[];
}

async function notifyParent(
  match: { id: string; opponent: string; teamName: string },
  parent: ParentTarget,
  transports: NotificationTransports,
): Promise<ParentOutcome> {
  const playerIds = parent.children.map((c) => c.id);
  const claimed = await claim(match.id, parent.id, playerIds);
  if (claimed === "duplicate") return { parentId: parent.id, result: "duplicate" };
  if (claimed === "rate_limited") return { parentId: parent.id, result: "skipped", reason: "rate_limited" };

  const names = parent.children.map((c) => c.name);
  const primary = parent.children[0];
  let outcome: ParentOutcome | null = null;
  let pushReason: string | null = null;

  // 1. Push, if the parent has it anywhere.
  const subs = transports.pushEnabled() ? parent.subscriptions.filter((s) => isAllowedPushEndpoint(s.endpoint)) : [];
  if (subs.length > 0) {
    const message = matchStartPush({
      names,
      teamName: match.teamName,
      opponent: match.opponent,
      playerId: primary.id,
      matchId: match.id,
    });
    const results = await Promise.all(subs.map(async (s) => ({ s, r: await transports.push(s, message) })));
    const now = new Date();
    await Promise.all(
      results.map(({ s, r }) =>
        r.ok
          ? prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSuccessAt: now, lastError: null } })
          : prisma.pushSubscription.update({
              where: { id: s.id },
              // Gone (404/410) = expired or permission revoked: stop using it.
              // Anything else (push service hiccup) keeps the device but this
              // alert still falls back to email below.
              data: r.gone ? { active: false, expiredAt: now, lastError: r.message } : { lastError: r.message },
            }),
      ),
    );
    if (results.some(({ r }) => r.ok)) {
      outcome = { parentId: parent.id, result: "sent", channel: "PUSH", reason: null };
    } else {
      pushReason = results.every(({ r }) => !r.ok && r.gone) ? "push_expired" : "push_failed";
    }
  }

  // 2. Email, only when no push got through.
  if (!outcome) {
    if (!parent.emailMatchAlerts) {
      outcome = { parentId: parent.id, result: "skipped", reason: pushReason ? `${pushReason},email_opted_out` : "email_opted_out" };
    } else if (!transports.emailEnabled()) {
      outcome = { parentId: parent.id, result: "skipped", reason: pushReason ? `${pushReason},email_not_configured` : "email_not_configured" };
    } else {
      const content = matchStartEmail({
        names,
        opponent: match.opponent,
        watchUrl: `${appUrl()}/parent/player/${primary.id}`,
      });
      const sent = await transports.email({
        to: parent.email,
        ...content,
        idempotencyKey: `match-start-${match.id}-${parent.id}`,
        headers: { "List-Unsubscribe": `<${appUrl()}/parent/settings#match-alerts>` },
      });
      outcome = sent.ok
        ? { parentId: parent.id, result: "sent", channel: "EMAIL", reason: pushReason }
        : { parentId: parent.id, result: "failed", reason: `${pushReason ? `${pushReason},` : ""}email_failed: ${sent.message}`.slice(0, 300) };
    }
  }

  await prisma.matchNotification.update({
    where: { id: claimed.id },
    data:
      outcome.result === "sent"
        ? { status: "SENT", channel: outcome.channel, reason: outcome.reason, sentAt: new Date() }
        : outcome.result === "failed"
          ? { status: "FAILED", channel: "EMAIL", reason: outcome.reason }
          : { status: "SKIPPED", channel: "NONE", reason: outcome.result === "skipped" ? outcome.reason : null },
  });
  return outcome;
}

// Alert the parents of `starterIds` (the confirmed starting lineup). Players
// not on this team, or no longer on the roster, are ignored.
export async function notifyMatchStart(
  matchId: string,
  starterIds: string[],
  opts: { transports?: NotificationTransports } = {},
): Promise<NotifySummary> {
  const transports = opts.transports ?? defaultTransports;
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      opponent: true,
      result: true,
      tournament: {
        select: { team: { select: { id: true, name: true, allowParentView: true, notifyParentsOnStart: true } } },
      },
    },
  });
  if (!match) return emptySummary("match_not_found");
  const team = match.tournament.team;
  if (match.result) return emptySummary("match_finished");
  if (!team.allowParentView) return emptySummary("parent_view_off");
  if (!team.notifyParentsOnStart) return emptySummary("notifications_off");

  const order = [...new Set(starterIds)];
  const starters = await prisma.player.findMany({
    where: { id: { in: order }, teamId: team.id, isActive: true },
    select: {
      id: true,
      name: true,
      parentLinks: {
        select: {
          parent: {
            select: {
              id: true,
              email: true,
              role: true,
              emailMatchAlerts: true,
              pushSubscriptions: {
                where: { active: true },
                select: { id: true, endpoint: true, p256dh: true, auth: true },
              },
            },
          },
        },
      },
    },
  });

  // Group by parent, children in lineup order (siblings get one alert).
  const byId = new Map(starters.map((p) => [p.id, p]));
  const parents = new Map<string, ParentTarget>();
  for (const playerId of order) {
    const player = byId.get(playerId);
    if (!player) continue;
    for (const { parent } of player.parentLinks) {
      if (parent.role !== "PARENT") continue;
      const entry =
        parents.get(parent.id) ??
        { id: parent.id, email: parent.email, emailMatchAlerts: parent.emailMatchAlerts, subscriptions: parent.pushSubscriptions, children: [] };
      entry.children.push({ id: player.id, name: player.name });
      parents.set(parent.id, entry);
    }
  }

  const summary = emptySummary(null);
  const settled = await Promise.allSettled(
    [...parents.values()].map((p) => notifyParent({ id: match.id, opponent: match.opponent, teamName: team.name }, p, transports)),
  );
  for (const s of settled) {
    if (s.status === "rejected") {
      summary.failed += 1;
      console.error("[match-notifications]", s.reason);
      continue;
    }
    const o = s.value;
    summary.parents.push(o);
    if (o.result === "sent") {
      summary.notified += 1;
      if (o.channel === "PUSH") summary.push += 1;
      else summary.email += 1;
    } else if (o.result === "duplicate") summary.duplicates += 1;
    else if (o.result === "skipped") summary.skipped += 1;
    else summary.failed += 1;
  }
  return summary;
}

// "Start match" from the courtside page. The first call for a match marks it
// started and alerts the lineup's parents. Later calls (the coach fixes the
// lineup, reopens the page on another phone) only alert parents of newly
// added starters, and only until the first point is scored; after that the
// lineup is no longer the starting lineup.
export async function startMatch(
  matchId: string,
  starterIds: string[],
  opts: { transports?: NotificationTransports } = {},
): Promise<NotifySummary & { firstStart: boolean; underway: boolean }> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { result: true, tournament: { select: { teamId: true } } },
  });
  if (!match) return { ...emptySummary("match_not_found"), firstStart: false, underway: false };
  if (match.result) return { ...emptySummary("match_finished"), firstStart: false, underway: false };

  const { count } = await prisma.match.updateMany({
    where: { id: matchId, startedAt: null },
    data: { startedAt: new Date() },
  });
  const firstStart = count === 1;
  if (firstStart) invalidateLive({ matchId, teamId: match.tournament.teamId });

  const scored = await prisma.matchSetScore.findFirst({
    where: { matchId, OR: [{ us: { gt: 0 } }, { them: { gt: 0 } }] },
    select: { id: true },
  });
  const underway = scored !== null;
  // A first start that arrives late (the coach was offline) still alerts.
  if (!firstStart && underway) {
    return { ...emptySummary("already_underway"), firstStart, underway };
  }
  const summary = await notifyMatchStart(matchId, starterIds, opts);
  return { ...summary, firstStart, underway };
}
