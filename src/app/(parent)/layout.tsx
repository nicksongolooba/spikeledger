import { requireParent } from "@/lib/session";
import { ParentShell } from "@/components/layout/ParentShell";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireParent();
  return <ParentShell user={{ email: user.email, name: user.name }}>{children}</ParentShell>;
}
