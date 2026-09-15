import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PrefsSchema = z
  .object({
    emailMatchAlerts: z.boolean().optional(),
    installCardDismissed: z.literal(true).optional(),
  })
  .refine((d) => d.emailMatchAlerts !== undefined || d.installCardDismissed !== undefined, "Nothing to update");

// PATCH: parent notification preferences.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = PrefsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { count } = await prisma.user.updateMany({
    where: { id: userId, role: "PARENT" },
    data: {
      ...(parsed.data.emailMatchAlerts !== undefined && { emailMatchAlerts: parsed.data.emailMatchAlerts }),
      ...(parsed.data.installCardDismissed && { installCardDismissedAt: new Date() }),
    },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
