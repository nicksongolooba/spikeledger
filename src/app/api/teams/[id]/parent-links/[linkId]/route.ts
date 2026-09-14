import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertTeamOwnership } from "@/lib/access";
import { markParentLinkSeen, revokeParentLink } from "@/lib/parent";

async function authorize(teamId: string) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owns = await assertTeamOwnership(teamId, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return null;
}

// DELETE: remove one parent's access to one player. Coach only.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; linkId: string } },
) {
  const denied = await authorize(params.id);
  if (denied) return denied;
  const ok = await revokeParentLink(params.id, params.linkId);
  if (!ok) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

const PatchSchema = z.object({ seen: z.literal(true) });

// PATCH { seen: true }: dismiss the "parent linked" notice. Coach only.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; linkId: string } },
) {
  const denied = await authorize(params.id);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!PatchSchema.safeParse(body).success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await markParentLinkSeen(params.id, params.linkId);
  return NextResponse.json({ ok: true });
}
