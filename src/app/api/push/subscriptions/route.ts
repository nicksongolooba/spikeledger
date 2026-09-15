import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedPushEndpoint } from "@/lib/push";

export const dynamic = "force-dynamic";

const b64url = z.string().min(8).max(200).regex(/^[A-Za-z0-9_-]+=*$/);
const SubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: b64url, auth: b64url }),
  // The browser re-subscribed after we reported the old endpoint expired.
  renewed: z.boolean().optional(),
  // Sent by the service worker's pushsubscriptionchange handler.
  replaces: z.string().url().max(1000).optional(),
});
const UnsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) });

async function parentId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "PARENT" ? userId : null;
}

// POST: this device turned match alerts on. Upserts by endpoint, so a shared
// family tablet follows whoever is signed in.
export async function POST(req: Request) {
  const userId = await parentId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = SubscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const { endpoint, keys, renewed, replaces } = parsed.data;
  if (!isAllowedPushEndpoint(endpoint)) {
    return NextResponse.json({ error: "Unsupported push service" }, { status: 400 });
  }

  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { expiredAt: true },
  });
  // The push service already told us this endpoint is dead; the browser needs
  // a fresh subscription (the client unsubscribes and tries once more).
  if (existing?.expiredAt && !renewed) {
    return NextResponse.json({ error: "Subscription expired", expired: true }, { status: 409 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { parentId: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: {
      parentId: userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
      active: true,
      expiredAt: null,
      lastError: null,
    },
  });
  if (replaces && replaces !== endpoint) {
    await prisma.pushSubscription.updateMany({
      where: { endpoint: replaces, parentId: userId },
      data: { active: false },
    });
  }
  const activeDevices = await prisma.pushSubscription.count({ where: { parentId: userId, active: true } });
  return NextResponse.json({ ok: true, activeDevices });
}

// DELETE: alerts turned off on this device.
export async function DELETE(req: Request) {
  const userId = await parentId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = UnsubscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  await prisma.pushSubscription.updateMany({
    where: { endpoint: parsed.data.endpoint, parentId: userId },
    data: { active: false },
  });
  const activeDevices = await prisma.pushSubscription.count({ where: { parentId: userId, active: true } });
  return NextResponse.json({ ok: true, activeDevices });
}
