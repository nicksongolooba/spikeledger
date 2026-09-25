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

// Any signed-in user, whatever their role.
export async function requireUser(): Promise<CoachSession> {
  const user = await loadSessionUser();
  if (!user) redirect("/login");
  return user;
}

// Coach pages. Each page calls this itself rather than relying on the (app)
// layout: a layout is not re-run for every request that renders a page (an
// RSC request can ask for the page segment alone), and middleware only checks
// for a valid session token, not the user's role. Parents go to their own area.
export async function requireCoach(): Promise<CoachSession> {
  const user = await requireUser();
  if (user.role === "PARENT") redirect("/parent");
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
