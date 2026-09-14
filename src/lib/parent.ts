// Parent access: coaches hand a short code to a parent, the parent links it
// to their account, and from then on sees ONLY that player's data (never
// teammates, rosters or coach tools). One parent can follow several players
// (siblings on different teams); one player can have several parents.

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

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

// Issue (or re-issue) a player's parent code. Re-issuing invalidates the old
// code for NEW links but keeps existing parents linked.
export async function issueParentCode(playerId: string): Promise<string> {
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
    await prisma.player.update({
      where: { id: playerId },
      data: { parentCode: code, parentCodeCreatedAt: new Date() },
    });
    return code;
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
      data: { parentCode: null, parentCodeCreatedAt: null },
    }),
  ]);
  return deleted.count;
}

// Parent redeems a code. Idempotent - linking twice is fine.
export async function linkParentByCode(parentId: string, rawCode: string) {
  const code = normalizeParentCode(rawCode);
  const player = await prisma.player.findUnique({
    where: { parentCode: code },
    include: { team: { select: { id: true, name: true, ageGroup: true } } },
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
  const link = await prisma.parentPlayerLink.upsert({
    where: { parentId_playerId: { parentId, playerId: player.id } },
    create: { parentId, playerId: player.id },
    update: {},
  });
  return { link, player };
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
