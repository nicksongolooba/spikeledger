// PATCH /api/club - club settings (name, logo URL, province). OWNER only.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClubMembership } from "@/lib/club";

const PatchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  logo: z.string().trim().url().max(500).optional().or(z.literal("")),
  province: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getClubMembership(userId);
  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the club owner can edit club settings." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const club = await prisma.club.update({
    where: { id: membership.club.id },
    data: {
      name: parsed.data.name,
      logo: parsed.data.logo || null,
      province: parsed.data.province || null,
    },
  });
  return NextResponse.json({ id: club.id, name: club.name });
}
