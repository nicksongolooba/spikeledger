import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Plan, UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface CoachSession {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  role: UserRole;
}

async function loadSessionUser(): Promise<CoachSession | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true, role: true },
  });
  if (!user) return null;
  return { id: userId, email: user.email, name: user.name, plan: user.plan, role: user.role };
}

// Any signed-in user (coach pages call this; the (app) layout bounces
// parents to their own area).
export async function requireUser(): Promise<CoachSession> {
  const user = await loadSessionUser();
  if (!user) redirect("/login");
  return user;
}

// Parent-only pages. Coaches who wander in go back to their dashboard.
export async function requireParent(): Promise<CoachSession> {
  const user = await loadSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "PARENT") redirect("/dashboard");
  return user;
}

// Where a user lands after login, by role.
export function homeFor(role: UserRole): string {
  return role === "PARENT" ? "/parent" : "/dashboard";
}
