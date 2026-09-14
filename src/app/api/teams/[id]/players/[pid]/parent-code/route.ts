import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTeamOwnership } from "@/lib/access";
import { issueParentCode, revokeParentAccess, ParentError } from "@/lib/parent";

async function authorize(params: { id: string; pid: string }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const owns = await assertTeamOwnership(params.id, userId);
  if (!owns) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const player = await prisma.player.findFirst({
    where: { id: params.pid, teamId: params.id },
    select: { id: true, parentCode: true },
  });
  if (!player) return { error: NextResponse.json({ error: "Player not found" }, { status: 404 }) };
  return { player };
}

// POST: issue a code (or regenerate one). Coach only.
export async function POST(
  _req: Request,
  { params }: { params: { id: string; pid: string } },
) {
  const auth = await authorize(params);
  if ("error" in auth) return auth.error;
  try {
    const code = await issueParentCode(auth.player.id);
    return NextResponse.json({ code });
  } catch (err) {
    if (err instanceof ParentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// DELETE: revoke - unlinks every parent and clears the code. Coach only.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; pid: string } },
) {
  const auth = await authorize(params);
  if ("error" in auth) return auth.error;
  const removed = await revokeParentAccess(auth.player.id);
  return NextResponse.json({ ok: true, removed });
}
