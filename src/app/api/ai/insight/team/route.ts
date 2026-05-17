import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeamInsight } from "@/engine/ai";
import { buildTeamInsightRequest } from "@/engine/ai/request-builders";

const BodySchema = z.object({
  teamId: z.string().min(1),
  scope: z.enum(["tournament", "season"]),
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

  const team = await prisma.team.findFirst({
    where: { id: parsed.data.teamId, coachId: userId },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // AI insights are a paid feature.
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  if (me) {
    const { canUserPerformAction } = await import("@/lib/plan-limits");
    const check = canUserPerformAction(me.plan, "ai-insights");
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

  // Pull tournaments + matches + stat lines, optionally narrowed to a single
  // tournament if scope === "tournament".
  const tournamentWhere =
    parsed.data.scope === "tournament" && parsed.data.scopeId
      ? { id: parsed.data.scopeId, teamId: team.id }
      : { teamId: team.id };

  const [tournaments, players, statLines] = await Promise.all([
    prisma.tournament.findMany({
      where: tournamentWhere,
      orderBy: { startDate: "asc" },
      include: {
        matches: { select: { id: true, result: true } },
      },
    }),
    prisma.player.findMany({
      where: { teamId: team.id, isActive: true },
    }),
    prisma.statLine.findMany({
      where:
        parsed.data.scope === "tournament" && parsed.data.scopeId
          ? { match: { tournamentId: parsed.data.scopeId } }
          : { match: { tournament: { teamId: team.id } } },
    }),
  ]);

  const scopedLinesByPlayer = new Map<string, typeof statLines>();
  for (const s of statLines) {
    if (!scopedLinesByPlayer.has(s.playerId)) scopedLinesByPlayer.set(s.playerId, []);
    scopedLinesByPlayer.get(s.playerId)!.push(s);
  }

  const scopeLabel =
    parsed.data.scope === "tournament" && tournaments.length === 1
      ? tournaments[0].name
      : "Full Season";

  const linesByTournament = new Map<string, typeof statLines>();
  for (const s of statLines) {
    const m = tournaments
      .flatMap((t) => t.matches.map((m) => ({ tid: t.id, mid: m.id })))
      .find((x) => x.mid === s.matchId);
    if (!m) continue;
    if (!linesByTournament.has(m.tid)) linesByTournament.set(m.tid, []);
    linesByTournament.get(m.tid)!.push(s);
  }

  const request = buildTeamInsightRequest({
    team: { id: team.id, name: team.name },
    scope: parsed.data.scope,
    scopeId: parsed.data.scopeId ?? null,
    scopeLabel,
    tournaments: tournaments.map((t) => ({
      tournament: t,
      matches: t.matches,
      statLines: linesByTournament.get(t.id) ?? [],
    })),
    roster: players,
    scopedLinesByPlayer,
  });

  const response = await getTeamInsight(request);
  return NextResponse.json(response);
}
