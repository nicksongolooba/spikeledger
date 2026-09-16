import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getClubAccess } from "@/lib/club";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Parent accounts have their own area - no roster, no coach tools.
  if (user.role === "PARENT") redirect("/parent");
  // Club tools are CLUB tier only. Membership alone is not enough: a coach
  // whose club has gone dormant, or who downgraded, sees no Club item.
  const showClub = (await getClubAccess(user.id, user.plan)).allowed;
  return (
    <AppShell user={{ email: user.email, name: user.name }} showClub={showClub}>
      {children}
    </AppShell>
  );
}
