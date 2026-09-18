import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTeamOwnership } from "@/lib/access";
import { invalidateLive } from "@/lib/live-cache";

const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ageGroup: z.string().max(20).nullable().optional(),
  season: z.string().max(20).nullable().optional(),
  usesPositions: z.boolean().optional(),
  allowParentView: z.boolean().optional(),
  showBenchStatusToParents: z.boolean().optional(),
  notifyParentsOnStart: z.boolean().optional(),
});

// PATCH: team settings. Creating coach only.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owns = await assertTeamOwnership(params.id, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = UpdateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const team = await prisma.team.update({
    where: { id: params.id },
    data: {
      ...(d.name !== undefined && { name: d.name.trim() }),
      ...(d.ageGroup !== undefined && { ageGroup: d.ageGroup?.trim() || null }),
      ...(d.season !== undefined && { season: d.season?.trim() || null }),
      ...(d.usesPositions !== undefined && { usesPositions: d.usesPositions }),
      ...(d.allowParentView !== undefined && { allowParentView: d.allowParentView }),
      ...(d.showBenchStatusToParents !== undefined && {
        showBenchStatusToParents: d.showBenchStatusToParents,
      }),
      ...(d.notifyParentsOnStart !== undefined && { notifyParentsOnStart: d.notifyParentsOnStart }),
    },
  });
  invalidateLive({ teamId: params.id });
  return NextResponse.json(team);
}
