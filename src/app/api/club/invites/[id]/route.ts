// DELETE /api/club/invites/[id] - revoke a pending invite. OWNER only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClubMembership } from "@/lib/club";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getClubMembership(userId);
  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the club owner can revoke invites." },
      { status: 403 },
    );
  }

  const invite = await prisma.clubInvite.findFirst({
    where: { id: params.id, clubId: membership.club.id, acceptedAt: null },
    select: { id: true },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  await prisma.clubInvite.delete({ where: { id: invite.id } });
  return NextResponse.json({ ok: true });
}
