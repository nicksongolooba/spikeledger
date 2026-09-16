"use client";

import { Check, Download } from "lucide-react";
import { useInstallPrompt } from "@/lib/push-client";
import { useInstallState } from "@/lib/install-state";
import { cn } from "@/lib/utils";

// "Install SpikeLedger" for the landing page's install section. Shows only
// when the browser offers installation (Chromium on Android and laptops) and
// the app is not already installed; Safari visitors follow the written steps
// beside it.
export function InstallAppButton({ className }: { className?: string }) {
  const { canInstall, promptInstall } = useInstallPrompt();
  const installState = useInstallState();
  if (installState === "checking") return null;
  if (installState === "installed") {
    return (
      <p className={cn("inline-flex items-center gap-2 text-sm font-semibold text-green-700", className)}>
        <Check size={16} strokeWidth={2.5} aria-hidden />
        Installed. Open SpikeLedger from your home screen.
      </p>
    );
  }
  if (!canInstall) return null;
  return (
    <button type="button" onClick={() => void promptInstall()} className={cn("btn-primary px-6 py-3 text-base", className)}>
      <Download size={18} strokeWidth={2} aria-hidden />
      Install SpikeLedger
    </button>
  );
}
