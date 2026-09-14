import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlayerInsight } from "@/engine/ai";
import { buildPlayerInsightRequest } from "@/engine/ai/request-builders";

const BodySchema = z.object({
  playerId: z.string().min(1),
  scope: z.enum(["match", "tournament", "season"]),
  scopeId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { teamVisibleWhere } = await import("@/lib/access");
  const player = await prisma.player.findFirst({
    where: { id: parsed.data.playerId, team: teamVisibleWhere(userId) },
    include: { team: true },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // AI insights are a paid feature (club members inherit the tier).
  const { getEffectivePlan } = await import("@/lib/club");
  const plan = await getEffectivePlan(userId);
  {
    const { canUserPerformAction } = await import("@/lib/plan-limits");
    const check = canUserPerformAction(plan, "ai-insights");
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: check.reason?.reason ?? "AI insights require Coach Pro.",
          upgradeReason: check.reason,
        },
        { status: 402 },
      );
    }
  }

  // Build the filter on StatLine for the requested scope.
  let scopeLabel = "Full Season";
  let lineFilter: { match: object } = { match: {} };
  if (parsed.data.scope === "match" && parsed.data.scopeId) {
    const match = await prisma.match.findFirst({
      where: {
        id: parsed.data.scopeId,
        tournament: { teamId: player.teamId },
      },
      include: { tournament: true },
    });
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    scopeLabel = `${match.tournament.name} · Match ${match.matchNumber} (vs ${match.opponent})`;
    lineFilter = { match: { id: match.id } };
  } else if (parsed.data.scope === "tournament" && parsed.data.scopeId) {
    const tournament = await prisma.tournament.findFirst({
      where: { id: parsed.data.scopeId, teamId: player.teamId },
    });
    if (!tournament)
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    scopeLabel = tournament.name;
    lineFilter = { match: { tournamentId: tournament.id } };
  } else {
    lineFilter = { match: { tournament: { teamId: player.teamId } } };
  }

  const playerLines = await prisma.statLine.findMany({
    where: { playerId: player.id, ...lineFilter },
    include: { match: { include: { tournament: true } } },
  });

  if (playerLines.length === 0) {
    return NextResponse.json(
      { error: "No stats yet for this scope." },
      { status: 404 },
    );
  }

  // For trend, bucket lines by tournament (skip for single-match scope).
  let trendBuckets: { label: string; lines: typeof playerLines }[] | undefined;
  if (parsed.data.scope !== "match") {
    const byTournament = new Map<
      string,
      { label: string; lines: typeof playerLines }
    >();
    for (const l of playerLines) {
      const key = l.match.tournament.id;
      if (!byTournament.has(key)) {
        byTournament.set(key, { label: l.match.tournament.name, lines: [] });
      }
      byTournament.get(key)!.lines.push(l);
    }
    trendBuckets = [...byTournament.values()];
  }

  const request = buildPlayerInsightRequest({
    player,
    usesPositions: player.team.usesPositions,
    scope: parsed.data.scope,
    scopeId: parsed.data.scopeId ?? null,
    scopeLabel,
    ageGroup: player.team.ageGroup,
    playerLines,
    trendBuckets,
  });

  // The Refresh button sends X-Refresh: 1 to bypass the (year-long) cache.
  const forceRefresh = req.headers.get("x-refresh") === "1";
  const response = await getPlayerInsight(request, { forceRefresh });
  return NextResponse.json(response);
}
