import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCoachOwnsMatch } from "@/lib/match-access";
import { STAT_ACTION_FIELDS, type StatActionId } from "@/lib/stat-actions";
import { invalidateLive } from "@/lib/live-cache";

const BodySchema = z.object({
  playerId: z.string().min(1),
  action: z.string().min(1),
  value: z.number().int().min(1).max(20).default(1),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertCoachOwnsMatch(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  if (!(parsed.data.action in STAT_ACTION_FIELDS)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const field = STAT_ACTION_FIELDS[parsed.data.action as StatActionId];

  const existing = await prisma.statLine.findUnique({
    where: {
      matchId_playerId: { matchId: params.id, playerId: parsed.data.playerId },
    },
  });
  if (!existing) {
    // Nothing to undo - treat as a no-op so the client stays in sync.
    return NextResponse.json({ ok: true, noop: true });
  }

  // Clamp at 0 so undo never makes a field negative.
  const current = (existing as unknown as Record<string, number>)[field] ?? 0;
  const decrement = Math.min(parsed.data.value, current);
  if (decrement === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const updated = await prisma.statLine.update({
    where: { id: existing.id },
    data: { [field]: { decrement } },
  });
  invalidateLive({ matchId: params.id });

  return NextResponse.json(updated);
}
