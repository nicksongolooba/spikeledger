// Parent access: coaches hand a short code to a parent, the parent links it
// to their account, and from then on sees ONLY that player's data (never
// teammates, rosters or coach tools). One parent can follow several players
// (siblings on different teams); one player can have several parents.

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  PARENT_CODE_MAX_REDEMPTIONS,
  PARENT_CODE_TTL_DAYS,
  parentCodeStatus,
} from "@/lib/parent-constants";

export { PARENT_CODE_MAX_REDEMPTIONS, PARENT_CODE_TTL_DAYS, parentCodeStatus };

export class ParentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// No 0/O or 1/I - codes get read out loud in a gym.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// "Thunder Hawks 16U" -> "THUN". Letters only so the prefix is speakable.
export function teamPrefix(teamName: string): string {
  const letters = teamName.toUpperCase().replace(/[^A-Z]/g, "");
  return (letters.slice(0, 4) || "SPKE").padEnd(4, "X");
}

// Accept "hawk-7k2", "HAWK 7K2", "hawk7k2"; store as "HAWK-7K2".
export function normalizeParentCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== 7) return raw.trim().toUpperCase();
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

export interface IssuedParentCode {
  code: string;
  expiresAt: Date;
  redemptions: number;
  maxRedemptions: number;
}

// Issue (or re-issue) a player's parent code: 3 redemptions, 30 days. A new
// code invalidates the old one for NEW links but keeps existing parents.
export async function issueParentCode(playerId: string): Promise<IssuedParentCode> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: { select: { name: true } } },
  });
  if (!player) throw new ParentError("Player not found", 404);
  const prefix = teamPrefix(player.team.name);
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Array.from(
      { length: 3 },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    ).join("");
    const code = `${prefix}-${suffix}`;
    const clash = await prisma.player.findUnique({
      where: { parentCode: code },
      select: { id: true },
    });
    if (clash) continue;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PARENT_CODE_TTL_DAYS * 24 * 60 * 60 * 1000);
    await prisma.player.update({
      where: { id: playerId },
      data: {
        parentCode: code,
        parentCodeCreatedAt: now,
        parentCodeExpiresAt: expiresAt,
        parentCodeRedemptions: 0,
      },
    });
    return { code, expiresAt, redemptions: 0, maxRedemptions: PARENT_CODE_MAX_REDEMPTIONS };
  }
  throw new ParentError("Could not generate a unique code - try again.", 500);
}

// Coach revokes parent access for a player: every linked parent loses the
// player and the code stops working.
export async function revokeParentAccess(playerId: string): Promise<number> {
  const [deleted] = await prisma.$transaction([
    prisma.parentPlayerLink.deleteMany({ where: { playerId } }),
    prisma.player.update({
      where: { id: playerId },
      data: {
        parentCode: null,
        parentCodeCreatedAt: null,
        parentCodeExpiresAt: null,
        parentCodeRedemptions: 0,
      },
    }),
  ]);
  return deleted.count;
}

// Coach removes ONE parent's access to a player (wrong person redeemed the
// code). Other links and the code itself are untouched.
export async function revokeParentLink(teamId: string, linkId: string): Promise<boolean> {
  const { count } = await prisma.parentPlayerLink.deleteMany({
    where: { id: linkId, player: { teamId } },
  });
  return count > 0;
}

// Coach dismisses the "X's parent linked" notice.
export async function markParentLinkSeen(teamId: string, linkId: string): Promise<boolean> {
  const { count } = await prisma.parentPlayerLink.updateMany({
    where: { id: linkId, player: { teamId }, coachSeenAt: null },
    data: { coachSeenAt: new Date() },
  });
  return count > 0;
}

// Links the coach hasn't acknowledged yet, newest first.
export async function getUnseenParentLinks(teamId: string) {
  return prisma.parentPlayerLink.findMany({
    where: { player: { teamId }, coachSeenAt: null },
    orderBy: { linkedAt: "desc" },
    include: {
      parent: { select: { name: true, email: true } },
      player: { select: { id: true, name: true } },
    },
  });
}

// Parent redeems a code. A code works 3 times within 30 days of being
// issued; a parent who is already linked can re-enter it freely without
// using up a redemption.
export async function linkParentByCode(parentId: string, rawCode: string) {
  const code = normalizeParentCode(rawCode);
  const player = await prisma.player.findUnique({
    where: { parentCode: code },
    include: {
      team: { select: { id: true, name: true, ageGroup: true } },
      parentLinks: { where: { parentId }, select: { id: true } },
    },
  });
  if (!player) {
    throw new ParentError(
      "That code doesn't match any player. Check it with the coach - codes look like HAWK-7K2.",
      404,
    );
  }
  if (!player.isActive) {
    throw new ParentError("That player is no longer on the roster.", 410);
  }
  const existing = player.parentLinks[0];
  if (existing) {
    const link = await prisma.parentPlayerLink.findUniqueOrThrow({ where: { id: existing.id } });
    return { link, player, alreadyLinked: true as const };
  }
  const status = parentCodeStatus(player);
  if (status.state === "expired") {
    throw new ParentError("This code has expired. Ask the coach for a new one.", 410);
  }
  if (status.state === "exhausted") {
    throw new ParentError(
      `This code has already been used ${PARENT_CODE_MAX_REDEMPTIONS} times. Ask the coach for a new one.`,
      409,
    );
  }
  // Consume a redemption and create the link atomically; the guarded
  // updateMany stops two parents racing past the cap.
  const link = await prisma.$transaction(async (tx) => {
    const consumed = await tx.player.updateMany({
      where: {
        id: player.id,
        parentCode: code,
        parentCodeRedemptions: { lt: PARENT_CODE_MAX_REDEMPTIONS },
      },
      data: { parentCodeRedemptions: { increment: 1 } },
    });
    if (consumed.count === 0) {
      throw new ParentError(
        `This code has already been used ${PARENT_CODE_MAX_REDEMPTIONS} times. Ask the coach for a new one.`,
        409,
      );
    }
    return tx.parentPlayerLink.create({ data: { parentId, playerId: player.id } });
  });
  return { link, player, alreadyLinked: false as const };
}

// Parent removes a player from their own account.
export async function unlinkParent(parentId: string, linkId: string): Promise<boolean> {
  const { count } = await prisma.parentPlayerLink.deleteMany({
    where: { id: linkId, parentId },
  });
  return count > 0;
}

export interface ParentPlayerSummary {
  linkId: string;
  linkedAt: Date;
  player: { id: string; name: string; number: number | null; isActive: boolean };
  team: {
    id: string;
    name: string;
    ageGroup: string | null;
    usesPositions: boolean;
    allowParentView: boolean;
  };
}

// Every player this parent follows. Inactive players and teams that paused
// the live view are still listed (with `isActive` / `allowParentView` false)
// so the dashboard can explain why a card is greyed out.
export async function getParentPlayers(parentId: string): Promise<ParentPlayerSummary[]> {
  const links = await prisma.parentPlayerLink.findMany({
    where: { parentId },
    orderBy: { linkedAt: "asc" },
    include: {
      player: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              ageGroup: true,
              usesPositions: true,
              allowParentView: true,
            },
          },
        },
      },
    },
  });
  return links.map((l) => ({
    linkId: l.id,
    linkedAt: l.linkedAt,
    player: {
      id: l.player.id,
      name: l.player.name,
      number: l.player.number,
      isActive: l.player.isActive,
    },
    team: l.player.team,
  }));
}

// The one gate every parent read goes through: linked + player still on the
// roster + team hasn't paused the parent view. Returns null when any fails.
export async function getPlayerForParent(parentId: string, playerId: string) {
  return prisma.player.findFirst({
    where: {
      id: playerId,
      isActive: true,
      parentLinks: { some: { parentId } },
      team: { allowParentView: true },
    },
    include: { team: true },
  });
}

// Linked parents for every player on a team (coach side).
export async function getTeamParentLinks(teamId: string) {
  return prisma.parentPlayerLink.findMany({
    where: { player: { teamId } },
    orderBy: [{ player: { number: "asc" } }, { linkedAt: "asc" }],
    include: {
      parent: { select: { id: true, name: true, email: true } },
      player: { select: { id: true, name: true, number: true } },
    },
  });
}
