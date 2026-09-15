import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { buildLivePayload, getMatchLive, getTeamLive } from "@/lib/parent-view";

export const dynamic = "force-dynamic";

// Per parent account: a healthy client polls 4x a minute (15s) plus the odd
// refetch when a tab comes back. Anything past this is a stuck client.
const POLL_LIMIT = { max: 8, windowMs: 60_000 };

// GET /api/parent/live?team=<teamId>&player=<playerId>
//
// The parent view's poll. Deliberately thin: the session comes from the JWT
// (no database), access and match data come from the in-process cache
// (src/lib/live-cache.ts), and unchanged data answers 304 to an
// If-None-Match. During a match the only database work behind hundreds of
// parents is the one cache fill per 10-second window.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`parent-live:${userId}`, POLL_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. The live view updates every 15 seconds." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const url = new URL(req.url);
  const teamId = url.searchParams.get("team") ?? "";
  const playerId = url.searchParams.get("player") ?? "";
  if (!teamId || !playerId) {
    return NextResponse.json({ error: "team and player are required" }, { status: 400 });
  }

  // Same gate as the page: linked to this player, player on the roster,
  // team allows the live view - all answered from the cached team context.
  const team = await getTeamLive(teamId);
  const player = team?.players[playerId];
  if (!team || !player || !player.isActive || !team.allowParentView || !player.parentIds.includes(userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const match = team.latestMatchId ? await getMatchLive(team.latestMatchId) : null;
  const payload = buildLivePayload(team, match, playerId);

  const headers: Record<string, string> = {
    ETag: payload.etag,
    "Cache-Control": "private, no-cache",
    "X-RateLimit-Remaining": String(limit.remaining),
  };
  if (req.headers.get("if-none-match") === payload.etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return NextResponse.json(payload, { headers });
}
