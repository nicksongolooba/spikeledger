// "Set up your club" - shown after Club checkout (or whenever the owner
// wants to edit club identity). Owner only.

import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/session";
import { ensureClubForOwner, getClubAccess } from "@/lib/club";
import { ClubSetupForm } from "./ClubSetupForm";

export const dynamic = "force-dynamic";

export default async function ClubSetupPage() {
  const user = await requireCoach();
  if (!(await getClubAccess(user.id, user.plan)).allowed) redirect("/dashboard");
  const membership = await ensureClubForOwner(user.id);
  if (!membership) redirect("/dashboard");
  if (membership.role !== "OWNER") redirect("/club");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">Set up your club</h1>
      <p className="mt-1 text-sm text-slate-600">
        This is how your club appears to the coaches you invite. You can change
        it any time.
      </p>
      <div className="card mt-6 p-6">
        <ClubSetupForm
          initial={{
            name: membership.club.name,
            logo: membership.club.logo ?? "",
            province: membership.club.province ?? "",
          }}
        />
      </div>
    </div>
  );
}
