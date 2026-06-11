// POST /api/club/invites/accept - join a club via invite code (any signed-in
// user). Re-validates expiry and the 15-coach cap at accept time.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { acceptInvite, ClubError } from "@/lib/club";

const BodySchema = z.object({ code: z.string().min(6).max(40) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
  }

  try {
    const result = await acceptInvite(parsed.data.code, userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ClubError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
