import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getClubMembership } from "@/lib/club";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Parent accounts have their own area - no roster, no coach tools.
  if (user.role === "PARENT") redirect("/parent");
  const showClub =
    user.plan === "CLUB" || Boolean(await getClubMembership(user.id));
  return (
    <AppShell user={{ email: user.email, name: user.name }} showClub={showClub}>
      {children}
    </AppShell>
  );
}
