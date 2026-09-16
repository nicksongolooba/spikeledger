"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { readFlag, useInstallPrompt, writeFlag } from "@/lib/push-client";
import { useInstallState } from "@/lib/install-state";

const DISMISS_KEY = "spikeledger:pwa-install-dismissed";

// Subtle "Add to home screen" banner. Shows only to someone who has not
// installed SpikeLedger, when the browser offers installation, and only until
// they dismiss it. Rendered on the landing page and dashboard. Shares the
// captured install event with the other install buttons, so only one of them
// can prompt.
export function InstallPrompt() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const installState = useInstallState();
  // Hidden until mounted: storage and display mode aren't known on the server.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(readFlag(DISMISS_KEY));
  }, []);

  function dismiss() {
    writeFlag(DISMISS_KEY);
    setDismissed(true);
  }

  // "checking" holds the banner back until the installed check has answered,
  // rather than flashing it at someone who already has the app.
  if (installState !== "not-installed" || dismissed || !canInstall) return null;

  return (
    <div data-install-banner="1" className="fixed inset-x-3 bottom-20 z-[120] mx-auto max-w-md lg:bottom-4">
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-pop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192-v4.png" alt="" className="h-10 w-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold leading-tight text-slate-900">Install SpikeLedger</p>
          <p className="mt-0.5 text-xs leading-snug text-slate-600">
            Add it to your home screen for the courtside page.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => void promptInstall()} className="btn-primary px-3 py-1.5">
            Install
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
