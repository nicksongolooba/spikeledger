import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPlayerForParent } from "@/lib/parent";
import { buildLiveSnapshot } from "@/lib/parent-view";

// GET: the child's current / most recent match, polled every 15s by the
// parent view while a match is in progress. Gated by the parent link, the
// player being on the roster, and the team's "allow parent live view" switch.
export async function GET(
  _req: Request,
  { params }: { params: { playerId: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const player = await getPlayerForParent(userId, params.playerId);
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const snapshot = await buildLiveSnapshot(player.id);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
