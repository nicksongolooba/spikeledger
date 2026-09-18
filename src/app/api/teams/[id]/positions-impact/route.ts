import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTeamOwnership } from "@/lib/access";
import { shareState } from "@/lib/share-links";

// GET /api/teams/[id]/positions-impact
//
// What actually changes if this team's positions mode is toggled.
//
// Scoring is derived on read, never stored, so flipping the mode silently
// re-scores every match this team has ever played. A coach who starts a season
// without positions and turns them on in January would change every past
// number, including the ones on report cards parents have already downloaded
// and the share links already sent. Nobody asked for that, so nobody gets it
// without being told the size of it first.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await assertTeamOwnership(params.id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Matches with at least one stat line are the ones that carry a score.
  const matches = await prisma.match.count({
    where: { tournament: { teamId: params.id }, statLines: { some: {} } },
  });
  const players = await prisma.player.count({ where: { teamId: params.id, isActive: true } });
  const reports = await prisma.report.findMany({
    where: { teamId: params.id },
    select: { expiresAt: true, revokedAt: true },
  });
  const shareLinks = reports.filter((r) => shareState(r) === "active").length;

  return NextResponse.json({ matches, players, shareLinks });
}
