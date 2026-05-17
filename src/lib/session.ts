import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Plan } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface CoachSession {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
}

export async function requireUser(): Promise<CoachSession> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true },
  });
  if (!user) {
    redirect("/login");
  }
  return {
    id: userId,
    email: user.email,
    name: user.name,
    plan: user.plan,
  };
}
