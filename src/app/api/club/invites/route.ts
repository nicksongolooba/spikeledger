// POST /api/club/invites - create an invite link (OWNER only, 15-coach cap).
// No email delivery yet: the response carries the link for the owner to copy.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createInvite, ClubError } from "@/lib/club";

const BodySchema = z.object({
  email: z.string().email("Enter a valid email"),
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

  try {
    const { code, expiresAt } = await createInvite(userId, parsed.data.email);
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.spikeledger.com";
    return NextResponse.json({
      code,
      url: `${base}/invite/${code}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ClubError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
