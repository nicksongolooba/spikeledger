// DELETE /api/club/members/[id] - remove a coach from the club. OWNER only;
// the owner cannot remove themselves (transfer/cancel is a billing action).
// The removed coach keeps their own teams - those just stop being club-shared
// from their side of the fence (their teams' clubId is cleared).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClubError, requireClubOwner } from "@/lib/club";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let membership;
  try {
    membership = await requireClubOwner(userId, "Only the club owner can remove coaches.");
  } catch (err) {
    if (err instanceof ClubError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const target = await prisma.clubMember.findFirst({
    where: { id: params.id, clubId: membership.club.id },
    select: { id: true, userId: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.role === "OWNER") {
    return NextResponse.json(
      { error: "The owner can't be removed from their own club." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.clubMember.delete({ where: { id: target.id } }),
    // Un-share the departing coach's teams so neither side keeps access
    // they shouldn't have.
    prisma.team.updateMany({
      where: { coachId: target.userId, clubId: membership.club.id },
      data: { clubId: null },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
