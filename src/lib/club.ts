// Club tier core: membership lookup, effective plan, club creation, and the
// invite lifecycle. Privacy model: teams are PRIVATE with owner oversight.
//   OWNER     - invite/remove coaches, club settings, sees ALL club teams
//               (read-only oversight), full write on own teams
//   COACH     - sees ONLY their own teams (identical to the Coach Pro
//               experience), full write on them; knows they're in the club
//   ASSISTANT - sees only teams explicitly assigned to them (assignments are
//               a future feature - today that means only teams they created)
//
// ACTIVE AND DORMANT CLUBS
//
// A club is ACTIVE while at least one OWNER still holds the CLUB plan. The
// moment that stops being true the club is DORMANT, and a dormant club grants
// nothing: no club page, no sidebar item, no invites, no owner oversight of
// other coaches' teams.
//
// Dormant is not deleted. The club row, its members, its invites and the
// clubId on every team all stay exactly as they were, so re-subscribing puts
// the club back the way the owner left it with nothing to rebuild.
//
// What a coach keeps when the club they were invited to goes dormant: their
// own teams, players, matches, stats and reports, all of it, in full. They
// created those and they own them. What they lose is only what the club was
// lending them: CLUB-tier features fall back to whatever plan they pay for
// themselves, and the club surfaces disappear. The owner loses oversight of
// other coaches' teams for the same reason.
//
// Club UI is CLUB-tier only. getClubAccess below is the single gate used by
// the page, the sidebar and every club API route.

import { randomBytes } from "node:crypto";
import type { ClubRole, Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/plan-limits";

const INVITE_TTL_DAYS = 14;

export interface ClubMembership {
  membershipId: string;
  role: ClubRole;
  club: {
    id: string;
    name: string;
    logo: string | null;
    province: string | null;
  };
}

export async function getClubMembership(
  userId: string,
): Promise<ClubMembership | null> {
  const m = await prisma.clubMember.findFirst({
    where: { userId },
    include: {
      club: { select: { id: true, name: true, logo: true, province: true } },
    },
  });
  if (!m) return null;
  return { membershipId: m.id, role: m.role, club: m.club };
}

const PLAN_RANK: Record<Plan, number> = { FREE: 0, COACH_PRO: 1, CLUB: 2 };

// The better of two tiers. Used so nobody is ever moved DOWN by a club: a
// Coach Pro who joins a club gains CLUB features, and loses them again if the
// club goes dormant, but never drops below what they pay for themselves.
export function higherPlan(a: Plan, b: Plan): Plan {
  return PLAN_RANK[a] >= PLAN_RANK[b] ? a : b;
}

// "This club still has an owner on the CLUB plan." Written as a reusable
// filter so visibility queries can fold it in instead of making a second
// round trip.
export const ACTIVE_CLUB_FILTER = {
  members: { some: { role: "OWNER" as ClubRole, user: { plan: "CLUB" as Plan } } },
};

// A club is active while at least one OWNER holds the CLUB plan. When that
// stops being true the club is dormant: still there, granting nothing.
export async function isClubActive(clubId: string): Promise<boolean> {
  const owner = await prisma.clubMember.findFirst({
    where: { clubId, role: "OWNER", user: { plan: "CLUB" } },
    select: { id: true },
  });
  return Boolean(owner);
}

// The tier a user's club membership lends them. FREE when they are in no club
// or the club has gone dormant.
export async function clubGrantedPlan(userId: string): Promise<Plan> {
  const membership = await prisma.clubMember.findFirst({
    where: { userId },
    select: { clubId: true },
  });
  if (!membership) return "FREE";
  return (await isClubActive(membership.clubId)) ? "CLUB" : "FREE";
}

// What this user can actually do: the better of what they pay for and what
// their club lends them. A dormant club lends nothing, which is what drops a
// downgraded owner back to their own plan.
export async function getEffectivePlan(userId: string): Promise<Plan> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  if (!user) return "FREE";
  if (user.plan === "CLUB") return "CLUB"; // already the top tier
  return higherPlan(user.plan, await clubGrantedPlan(userId));
}

// Why a user may or may not open the club surfaces.
//   ok       CLUB tier, either paid directly or lent by an active club
//   no-plan  not a club user at all
//   dormant  in a club whose owner no longer holds the CLUB plan
export type ClubAccessReason = "ok" | "no-plan" | "dormant";

export interface ClubAccess {
  allowed: boolean;
  reason: ClubAccessReason;
  membership: ClubMembership | null;
  ownPlan: Plan;
}

export const CLUB_ACCESS_MESSAGE: Record<Exclude<ClubAccessReason, "ok">, string> = {
  "no-plan": "Club tools are part of the Club plan.",
  dormant:
    "This club is dormant because its plan is no longer active. Subscribing to Club again brings it back exactly as it was.",
};

// The single gate for every club surface: the /club pages, the sidebar item
// and the club API routes. Pass `knownPlan` when the caller already loaded the
// user, to save a query on a path that runs on every page render.
export async function getClubAccess(userId: string, knownPlan?: Plan): Promise<ClubAccess> {
  let ownPlan = knownPlan;
  if (ownPlan === undefined) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    ownPlan = user?.plan ?? "FREE";
  }
  const membership = await getClubMembership(userId);
  // Paying for Club directly is enough on its own: the club gets created on
  // first visit if it does not exist yet.
  if (ownPlan === "CLUB") return { allowed: true, reason: "ok", membership, ownPlan };
  if (!membership) return { allowed: false, reason: "no-plan", membership: null, ownPlan };
  if (await isClubActive(membership.club.id)) {
    return { allowed: true, reason: "ok", membership, ownPlan };
  }
  return { allowed: false, reason: "dormant", membership, ownPlan };
}

// Called when a user lands on club surfaces with a CLUB plan but no club yet
// (fresh checkout, or a manually flipped plan). Creates the club with a
// placeholder name; /club/setup lets the owner finish it.
export async function ensureClubForOwner(
  userId: string,
): Promise<ClubMembership | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, name: true },
  });
  const existing = await getClubMembership(userId);
  if (existing) {
    // A club that has gone dormant hands nothing back, so a downgraded owner
    // cannot keep editing club settings through this door.
    return (await isClubActive(existing.club.id)) ? existing : null;
  }
  if (user?.plan !== "CLUB") return null;

  const club = await prisma.club.create({
    data: {
      name: user.name ? `${user.name}'s Club` : "My Volleyball Club",
      members: { create: { userId, role: "OWNER" } },
    },
  });

  // Link every team the owner already coaches to the new club, not just teams
  // created after setup. Without this, a coach's existing roster stays outside
  // the club and never appears in owner oversight.
  await prisma.team.updateMany({
    where: { coachId: userId },
    data: { clubId: club.id },
  });
  return {
    membershipId: (await prisma.clubMember.findFirst({
      where: { userId, clubId: club.id },
      select: { id: true },
    }))!.id,
    role: "OWNER",
    club: { id: club.id, name: club.name, logo: club.logo, province: club.province },
  };
}

export class ClubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Every club write goes through here: plan first, then role. Throws a
// ClubError the API routes turn straight into a response.
export async function requireClubOwner(
  userId: string,
  ownerMessage: string,
): Promise<ClubMembership> {
  const access = await getClubAccess(userId);
  if (!access.allowed) {
    throw new ClubError(
      CLUB_ACCESS_MESSAGE[access.reason as Exclude<ClubAccessReason, "ok">],
      403,
    );
  }
  if (!access.membership || access.membership.role !== "OWNER") {
    throw new ClubError(ownerMessage, 403);
  }
  return access.membership;
}

const MAX_COACHES = PLAN_LIMITS.CLUB.maxCoaches;

// OWNER-only. Enforces the 15-coach cap counting current members.
export async function createInvite(
  userId: string,
  email: string,
): Promise<{ code: string; expiresAt: Date }> {
  // A dormant club cannot take on new coaches, and a Coach Pro user has no
  // club to invite anyone into.
  const membership = await requireClubOwner(userId, "Only the club owner can invite coaches.");
  const memberCount = await prisma.clubMember.count({
    where: { clubId: membership.club.id },
  });
  if (memberCount >= MAX_COACHES) {
    throw new ClubError(
      `Your club already has ${MAX_COACHES} coaches - the Club plan maximum.`,
      409,
    );
  }
  const code = randomBytes(9).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.clubInvite.create({
    data: {
      clubId: membership.club.id,
      code,
      email: email.toLowerCase().trim(),
      invitedById: userId,
      expiresAt,
    },
  });
  return { code, expiresAt };
}

// Joins the invite's club as the invite's role. Throws ClubError with a
// user-facing message on any failure. Re-checks the coach cap at accept time
// so parallel invites can't overshoot it.
export async function acceptInvite(code: string, userId: string) {
  const invite = await prisma.clubInvite.findUnique({
    where: { code },
    include: { club: { select: { id: true, name: true } } },
  });
  if (!invite) throw new ClubError("This invite link is not valid.", 404);
  if (invite.acceptedAt) {
    throw new ClubError("This invite has already been used.", 409);
  }
  if (invite.expiresAt < new Date()) {
    throw new ClubError("This invite has expired - ask for a new link.", 410);
  }
  // An invite written while the club was paid for should not still work after
  // it has gone dormant: joining would grant nothing and explain nothing.
  if (!(await isClubActive(invite.clubId))) {
    throw new ClubError(
      `${invite.club.name} is not active right now, so this invite can't be used.`,
      403,
    );
  }

  const existingMembership = await prisma.clubMember.findFirst({
    where: { userId },
    select: { clubId: true },
  });
  if (existingMembership?.clubId === invite.clubId) {
    return { clubId: invite.clubId, clubName: invite.club.name, already: true };
  }
  if (existingMembership) {
    throw new ClubError("You already belong to another club.", 409);
  }

  const memberCount = await prisma.clubMember.count({
    where: { clubId: invite.clubId },
  });
  if (memberCount >= MAX_COACHES) {
    throw new ClubError(
      `${invite.club.name} is full (${MAX_COACHES} coaches).`,
      409,
    );
  }

  await prisma.$transaction([
    prisma.clubMember.create({
      data: { userId, clubId: invite.clubId, role: invite.role },
    }),
    prisma.clubInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedById: userId },
    }),
  ]);
  return { clubId: invite.clubId, clubName: invite.club.name, already: false };
}
