// DELETE /api/club/invites/[id] - revoke a pending invite. OWNER only.

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
    membership = await requireClubOwner(userId, "Only the club owner can revoke invites.");
  } catch (err) {
    if (err instanceof ClubError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const invite = await prisma.clubInvite.findFirst({
    where: { id: params.id, clubId: membership.club.id, acceptedAt: null },
    select: { id: true },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  await prisma.clubInvite.delete({ where: { id: invite.id } });
  return NextResponse.json({ ok: true });
}
