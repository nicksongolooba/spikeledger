// Club tier core: membership lookup, effective plan, club creation, and the
// invite lifecycle. Privacy model: teams are PRIVATE with owner oversight.
//   OWNER     - invite/remove coaches, club settings, sees ALL club teams
//               (read-only oversight), full write on own teams
//   COACH     - sees ONLY their own teams (identical to the Coach Pro
//               experience), full write on them; knows they're in the club
//   ASSISTANT - sees only teams explicitly assigned to them (assignments are
//               a future feature - today that means only teams they created)
// Club members inherit the club's feature tier: belonging to a club whose
// owner has an active CLUB subscription grants CLUB features.

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

// A member's features come from the club's subscription: if the club has an
// OWNER with an active CLUB plan, every member gets CLUB-tier features. A
// user's own paid plan always wins if it's higher than FREE.
export async function getEffectivePlan(userId: string): Promise<Plan> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  if (!user) return "FREE";
  if (user.plan !== "FREE") return user.plan;

  const membership = await prisma.clubMember.findFirst({
    where: { userId },
    select: { clubId: true },
  });
  if (!membership) return "FREE";

  const activeOwner = await prisma.clubMember.findFirst({
    where: {
      clubId: membership.clubId,
      role: "OWNER",
      user: { plan: "CLUB" },
    },
    select: { id: true },
  });
  return activeOwner ? "CLUB" : "FREE";
}

// Called when a user lands on club surfaces with a CLUB plan but no club yet
// (fresh checkout, or a manually flipped plan). Creates the club with a
// placeholder name; /club/setup lets the owner finish it.
export async function ensureClubForOwner(
  userId: string,
): Promise<ClubMembership | null> {
  const existing = await getClubMembership(userId);
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, name: true },
  });
  if (user?.plan !== "CLUB") return null;

  const club = await prisma.club.create({
    data: {
      name: user.name ? `${user.name}'s Club` : "My Volleyball Club",
      members: { create: { userId, role: "OWNER" } },
    },
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

const MAX_COACHES = PLAN_LIMITS.CLUB.maxCoaches;

// OWNER-only. Enforces the 15-coach cap counting current members.
export async function createInvite(
  userId: string,
  email: string,
): Promise<{ code: string; expiresAt: Date }> {
  const membership = await getClubMembership(userId);
  if (!membership || membership.role !== "OWNER") {
    throw new ClubError("Only the club owner can invite coaches.", 403);
  }
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
