"use client";

import { Check } from "lucide-react";
import { useInstallState } from "@/lib/install-state";

// Wraps the landing page's install steps and button. Someone who already has
// SpikeLedger gets a line saying so instead of being walked through installing
// it again.
//
// Unlike the floating banner, this one keeps rendering its children while the
// installed check is still running. The steps are part of what the page is
// about, so they belong in the server-rendered HTML for anyone reading or
// crawling it; only a confirmed install swaps them out.
export function InstallSteps({ children }: { children: React.ReactNode }) {
  const state = useInstallState();

  if (state === "installed") {
    return (
      <p className="mt-8 inline-flex items-center gap-2 text-base font-semibold text-green-700">
        <Check size={18} strokeWidth={2.5} aria-hidden />
        You already have SpikeLedger installed. Open it from your home screen.
      </p>
    );
  }
  return <>{children}</>;
}
