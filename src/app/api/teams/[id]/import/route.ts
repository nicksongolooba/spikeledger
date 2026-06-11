import { NextResponse } from "next/server";
import { z } from "zod";
import { Position, MatchResult } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTeamOwnership } from "@/lib/access";
import {
  parsePosition,
  parseNumber,
  AGGREGATE_MATCH_LABEL,
  type CanonicalField,
} from "@/lib/import-schema";

const PositionEnum = z.nativeEnum(Position);

const RowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));
const MappingSchema = z.record(z.string(), z.string().nullable());

const ImportSchema = z.object({
  tournamentName: z.string().min(1).max(120),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  // mapping: csvHeader → canonicalField (or null to skip)
  mapping: MappingSchema,
  rows: z.array(RowSchema).min(1).max(2000),
  // Optional: enforce a position fallback when a row's player can't be matched
  // against the active roster - we create the player on the fly.
  positionFallback: PositionEnum.optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertTeamOwnership(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // CSV/Excel import is a paid feature.
  const { getEffectivePlan } = await import("@/lib/club");
  const plan = await getEffectivePlan(userId);
  {
    const { canUserPerformAction } = await import("@/lib/plan-limits");
    const check = canUserPerformAction(plan, "csv-import");
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: check.reason?.reason ?? "Import requires Coach Pro.",
          upgradeReason: check.reason,
        },
        { status: 402 },
      );
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { tournamentName, startDate, endDate, location, mapping, rows } = parsed.data;

  // Reverse map: canonical → csv header.
  const inverse = new Map<CanonicalField, string>();
  for (const [csvHeader, canonical] of Object.entries(mapping)) {
    if (canonical) inverse.set(canonical as CanonicalField, csvHeader);
  }
  if (!inverse.has("player")) {
    return NextResponse.json(
      { error: "A Player column must be mapped." },
      { status: 400 },
    );
  }
  // No match column? The sheet is tournament/season totals - roll every row
  // into one synthetic "Tournament Aggregate" match.
  const useAggregate = !inverse.has("match");
  const matchLabelFor = (row: Record<string, unknown>): string =>
    useAggregate ? AGGREGATE_MATCH_LABEL : String(val(row, "match") ?? "").trim();

  const startD = new Date(startDate);
  if (Number.isNaN(startD.getTime())) {
    return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
  }
  let endD: Date | null = null;
  if (endDate) {
    endD = new Date(endDate);
    if (Number.isNaN(endD.getTime())) {
      return NextResponse.json({ error: "Invalid end date." }, { status: 400 });
    }
  }

  // Look up existing roster to match player names case-insensitively.
  const roster = await prisma.player.findMany({
    where: { teamId: params.id },
    select: { id: true, name: true, primaryPosition: true, number: true },
  });
  const rosterByLower = new Map(roster.map((p) => [p.name.toLowerCase().trim(), p]));

  function val(row: Record<string, unknown>, key: CanonicalField): unknown {
    const header = inverse.get(key);
    if (!header) return undefined;
    return row[header];
  }

  // Pre-scan: figure out unique match labels and unique player names; create
  // players that don't exist yet so we can foreign-key them.
  const matchLabels = new Set<string>();
  const playerNames = new Set<string>();
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const match = matchLabelFor(r);
    const player = String(val(r, "player") ?? "").trim();
    if (!useAggregate && !match) errors.push(`Row ${i + 2}: missing match label.`);
    if (!player) errors.push(`Row ${i + 2}: missing player name.`);
    if (match) matchLabels.add(match);
    if (player) playerNames.add(player);
  });
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.slice(0, 5).join(" ") }, { status: 400 });
  }

  // Create the tournament.
  const tournament = await prisma.tournament.create({
    data: {
      teamId: params.id,
      name: tournamentName.trim(),
      startDate: startD,
      endDate: endD,
      location: location?.trim() || null,
    },
  });

  // Create matches in stable order so matchNumber is deterministic.
  const matchLabelToId = new Map<string, string>();
  let matchNumber = 1;
  for (const label of matchLabels) {
    const m = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        opponent: label,
        matchNumber: matchNumber++,
      },
    });
    matchLabelToId.set(label, m.id);
  }

  // Create missing players.
  const fallback = parsed.data.positionFallback ?? "UTIL";
  for (const name of playerNames) {
    const lower = name.toLowerCase().trim();
    if (rosterByLower.has(lower)) continue;
    // Look ahead at the first row that mentions this name for a position hint.
    let posHint: Position | null = null;
    for (const r of rows) {
      const player = String(val(r, "player") ?? "").trim();
      if (player.toLowerCase() === lower) {
        const positionStr = val(r, "position");
        if (typeof positionStr === "string") {
          posHint = parsePosition(positionStr);
        }
        break;
      }
    }
    const created = await prisma.player.create({
      data: {
        teamId: params.id,
        name,
        primaryPosition: posHint ?? fallback,
      },
    });
    rosterByLower.set(lower, {
      id: created.id,
      name: created.name,
      primaryPosition: created.primaryPosition,
      number: created.number,
    });
  }

  // Build StatLines, aggregating rows that share (match, player).
  type StatAcc = {
    matchId: string;
    playerId: string;
    positionPlayed: Position | null;
    kills: number;
    attackErrors: number;
    attackAttempts: number;
    aces: number;
    serveErrors: number;
    serveAttempts: number;
    blocks: number;
    blockErrors: number;
    assists: number;
    settingErrors: number;
    sr0: number;
    sr1: number;
    sr2: number;
    sr3: number;
    digs: number;
    generalErrors: number;
    setsPlayed: number;
  };
  const acc = new Map<string, StatAcc>();
  const numericField = (
    row: Record<string, unknown>,
    field: CanonicalField,
  ): number => parseNumber(val(row, field));

  for (const r of rows) {
    const matchLabel = matchLabelFor(r);
    const playerName = String(val(r, "player") ?? "").trim();
    const matchId = matchLabelToId.get(matchLabel)!;
    const player = rosterByLower.get(playerName.toLowerCase().trim())!;
    const key = `${matchId}|${player.id}`;
    const existing =
      acc.get(key) ??
      ({
        matchId,
        playerId: player.id,
        positionPlayed:
          parsePosition(
            typeof val(r, "position") === "string"
              ? (val(r, "position") as string)
              : undefined,
          ) ?? player.primaryPosition,
        kills: 0,
        attackErrors: 0,
        attackAttempts: 0,
        aces: 0,
        serveErrors: 0,
        serveAttempts: 0,
        blocks: 0,
        blockErrors: 0,
        assists: 0,
        settingErrors: 0,
        sr0: 0,
        sr1: 0,
        sr2: 0,
        sr3: 0,
        digs: 0,
        generalErrors: 0,
        setsPlayed: 0,
      } satisfies StatAcc);
    existing.kills += numericField(r, "kills");
    existing.attackErrors += numericField(r, "attackErrors");
    existing.attackAttempts += numericField(r, "attackAttempts");
    existing.aces += numericField(r, "aces");
    existing.serveErrors += numericField(r, "serveErrors");
    existing.serveAttempts += numericField(r, "serveAttempts");
    existing.blocks += numericField(r, "blocks");
    existing.blockErrors += numericField(r, "blockErrors");
    existing.assists += numericField(r, "assists");
    existing.settingErrors += numericField(r, "settingErrors");
    existing.sr0 += numericField(r, "sr0");
    existing.sr1 += numericField(r, "sr1");
    existing.sr2 += numericField(r, "sr2");
    existing.sr3 += numericField(r, "sr3");
    existing.digs += numericField(r, "digs");
    existing.generalErrors += numericField(r, "generalErrors");
    existing.setsPlayed += numericField(r, "setsPlayed");
    acc.set(key, existing);
  }

  // Persist.
  for (const stat of acc.values()) {
    await prisma.statLine.upsert({
      where: {
        matchId_playerId: { matchId: stat.matchId, playerId: stat.playerId },
      },
      create: stat,
      update: stat,
    });
  }

  // Optionally infer match results from kill/error totals (skip - let the
  // coach edit results manually for accuracy).

  return NextResponse.json({
    tournamentId: tournament.id,
    matchesCreated: matchLabelToId.size,
    statLinesCreated: acc.size,
    playersCreated:
      rosterByLower.size - roster.length, // delta
  });
}

// Type alias to satisfy lint for unused import (MatchResult is referenced
// in case we ever auto-assign results - keep it imported so future work
// doesn't drop it).
export type _Unused = MatchResult;
