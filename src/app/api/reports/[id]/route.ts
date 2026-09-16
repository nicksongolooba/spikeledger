import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTeamOwnership } from "@/lib/access";

// DELETE /api/reports/[id] - revoke a public share link.
//
// The row is kept rather than deleted so the coach can still see that the link
// existed and when it was turned off. Revoking takes effect on the next
// request: /share/[id] and the preview image both check it.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    select: { id: true, teamId: true, revokedAt: true },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The coach who owns the team, not a club owner with read-only oversight:
  // turning off someone else's link is a write on their team.
  if (!(await assertTeamOwnership(report.teamId, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (report.revokedAt) return NextResponse.json({ ok: true, alreadyRevoked: true });
  const updated = await prisma.report.update({
    where: { id: report.id },
    data: { revokedAt: new Date() },
    select: { id: true, revokedAt: true },
  });
  return NextResponse.json({ ok: true, revokedAt: updated.revokedAt?.toISOString() });
}
