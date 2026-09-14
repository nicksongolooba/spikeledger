import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkParentByCode, ParentError } from "@/lib/parent";

const Schema = z.object({ code: z.string().trim().min(5).max(20) });

// POST: a signed-in parent redeems a code from their coach.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "PARENT") {
    return NextResponse.json({ error: "Only parent accounts can link players." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the code your coach gave you." }, { status: 400 });
  }
  try {
    const { link, player } = await linkParentByCode(userId, parsed.data.code);
    return NextResponse.json({
      linkId: link.id,
      player: { id: player.id, name: player.name, number: player.number },
      team: player.team,
    });
  } catch (err) {
    if (err instanceof ParentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
