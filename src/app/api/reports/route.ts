import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Each image is a base64 data URL captured by html-to-image on the client.
// We keep them inline on the Report row - fine for Phase 4 demo scale, will
// move to Cloudflare R2 in a future infra pass.
const ImageSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  dataUrl: z.string().regex(/^data:image\/png;base64,/, "Expected base64 PNG"),
});

const Schema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(120),
  scopeLabel: z.string().min(1).max(120),
  images: z.array(ImageSchema).min(1).max(8),
  parentFriendly: z.string().max(1000).optional(),
  aiProvider: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Confirm the player is on a team this coach owns.
  const player = await prisma.player.findFirst({
    where: { id: parsed.data.playerId, team: { coachId: userId } },
    include: { team: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Share-link creation is a paid feature.
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  if (me) {
    const { canUserPerformAction } = await import("@/lib/plan-limits");
    const check = canUserPerformAction(me.plan, "share-link");
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: check.reason?.reason ?? "Share links require Coach Pro.",
          upgradeReason: check.reason,
        },
        { status: 402 },
      );
    }
  }

  const report = await prisma.report.create({
    data: {
      teamId: player.teamId,
      type: "PLAYER_INDIVIDUAL",
      scope: `player:${parsed.data.playerId}|scope:${parsed.data.scopeLabel}`,
      imageUrls: parsed.data.images.map((img) => img.dataUrl),
      metadata: {
        playerId: parsed.data.playerId,
        playerName: parsed.data.playerName,
        teamName: player.team.name,
        scopeLabel: parsed.data.scopeLabel,
        keys: parsed.data.images.map((img) => img.key),
        labels: parsed.data.images.map((img) => img.label),
        parentFriendly: parsed.data.parentFriendly,
        aiProvider: parsed.data.aiProvider,
      },
    },
  });

  return NextResponse.json({ id: report.id });
}
