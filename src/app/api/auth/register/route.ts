import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { acceptInvite, ClubError } from "@/lib/club";

const RegisterSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  inviteCode: z.string().max(40).optional(),
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
    },
  });

  // Coach arrived via a club invite link - join them straight into the club.
  // A failed join (expired, club full) shouldn't fail the signup itself; the
  // message is surfaced so the UI can show it after login.
  let joinedClub: string | null = null;
  let inviteError: string | null = null;
  if (parsed.data.inviteCode) {
    try {
      const result = await acceptInvite(parsed.data.inviteCode, user.id);
      joinedClub = result.clubName;
    } catch (err) {
      inviteError = err instanceof ClubError ? err.message : "Could not join the club.";
    }
  }

  return NextResponse.json({ ok: true, joinedClub, inviteError });
}
