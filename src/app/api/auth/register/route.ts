import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { acceptInvite, ClubError } from "@/lib/club";
import { linkParentByCode, ParentError } from "@/lib/parent";

const RegisterSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(["COACH", "PARENT"]).default("COACH"),
  inviteCode: z.string().max(40).optional(),
  // Parents can redeem their child's code during signup (or later in settings).
  parentCode: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    },
  });

  // Coach arrived via a club invite link - join them straight into the club.
  // A failed join (expired, club full) shouldn't fail the signup itself; the
  // message is surfaced so the UI can show it after login.
  let joinedClub: string | null = null;
  let inviteError: string | null = null;
  if (parsed.data.role === "COACH" && parsed.data.inviteCode) {
    try {
      const result = await acceptInvite(parsed.data.inviteCode, user.id);
      joinedClub = result.clubName;
    } catch (err) {
      inviteError = err instanceof ClubError ? err.message : "Could not join the club.";
    }
  }

  // Parent signing up with their child's code - link now; a bad code is a
  // soft error (they can retry from settings).
  let linkedPlayer: string | null = null;
  let parentCodeError: string | null = null;
  if (parsed.data.role === "PARENT" && parsed.data.parentCode?.trim()) {
    try {
      const { player } = await linkParentByCode(user.id, parsed.data.parentCode);
      linkedPlayer = player.name;
    } catch (err) {
      parentCodeError = err instanceof ParentError ? err.message : "Could not link that code.";
    }
  }

  return NextResponse.json({
    ok: true,
    role: user.role,
    joinedClub,
    inviteError,
    linkedPlayer,
    parentCodeError,
  });
}
