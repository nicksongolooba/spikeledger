import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertCoachOwnsMatch } from "@/lib/match-access";
import { startMatch } from "@/lib/match-notifications";

export const dynamic = "force-dynamic";

const StartSchema = z.object({
  // The confirmed starting lineup (or a libero brought in before the first
  // rally). Validated against the roster in startMatch.
  playerIds: z.array(z.string().min(1)).min(1).max(12),
});

// POST: "Start match" on the courtside page. Marks the match started and
// alerts linked parents of the starters (push, else email; see
// src/lib/match-notifications.ts). Responds with how many parents were
// alerted so the coach sees "3 parents notified".
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertCoachOwnsMatch(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const result = await startMatch(params.id, parsed.data.playerIds);
  return NextResponse.json({
    notified: result.notified,
    push: result.push,
    email: result.email,
    skipped: result.skipped,
    failed: result.failed,
    alreadyNotified: result.duplicates,
    firstStart: result.firstStart,
    underway: result.underway,
    reason: result.reason,
  });
}
