import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <AppShell user={{ email: user.email, name: user.name }}>{children}</AppShell>
  );
}
