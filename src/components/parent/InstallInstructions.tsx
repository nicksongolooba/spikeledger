"use client";

import { BookOpen, ChevronLeft, ChevronRight, Copy, Download, EllipsisVertical, MonitorDown, Share, SquarePlus } from "lucide-react";
import { useInstallPrompt, type InstallPlatform } from "@/lib/push-client";

// How to put SpikeLedger on the home screen, per platform. Android and
// desktop Chromium get a real Install button when the browser offers one.
export function InstallInstructions({
  platform,
  onInstalled,
}: {
  platform: InstallPlatform;
  onInstalled?: () => void;
}) {
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  async function install() {
    const outcome = await promptInstall();
    if (outcome === "accepted") onInstalled?.();
  }

  if (platform === "ios") {
    return (
      <div data-install-steps="ios" className="space-y-3">
        <p className="font-semibold text-slate-900">
          Tap the Share button, then Add to Home Screen
        </p>
        <IosIllustration />
        <ol className="space-y-1.5 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <Step n={1} />
            <span>
              In Safari, tap <Share size={16} strokeWidth={2} className={ICON} aria-label="Share" />{" "}
              <span className="font-semibold">Share</span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Step n={2} />
            <span>
              Scroll down and tap <SquarePlus size={16} strokeWidth={2} className={ICON} aria-hidden />{" "}
              <span className="font-semibold">Add to Home Screen</span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Step n={3} />
            <span>Open SpikeLedger from your home screen and turn on alerts</span>
          </li>
        </ol>
      </div>
    );
  }

  if (installed) {
    return (
      <p data-install-steps={platform} className="text-sm text-slate-700">
        SpikeLedger is installed. Open it from your {platform === "android" ? "home screen" : "apps"} to turn on match alerts.
      </p>
    );
  }

  if (platform === "android") {
    return (
      <div data-install-steps="android" className="space-y-2 text-sm text-slate-700">
        {canInstall ? (
          <>
            <button type="button" onClick={install} className="btn-primary">
              <Download size={16} strokeWidth={2} aria-hidden />
              Install
            </button>
            <p>Adds SpikeLedger to your home screen. Open it from there to turn on alerts.</p>
          </>
        ) : (
          <p>
            Open the Chrome menu <EllipsisVertical size={16} strokeWidth={2} className={ICON} aria-label="menu" /> and
            tap <span className="font-semibold">Install app</span> or{" "}
            <span className="font-semibold">Add to Home screen</span>.
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-install-steps="desktop" className="space-y-2 text-sm text-slate-700">
      {canInstall && (
        <button type="button" onClick={install} className="btn-primary">
          <Download size={16} strokeWidth={2} aria-hidden />
          Install
        </button>
      )}
      <p>
        {canInstall ? "Or click" : "Click"} the install icon{" "}
        <MonitorDown size={16} strokeWidth={2} className={ICON} aria-hidden /> at the right end of the address
        bar, or open the browser menu and choose <span className="font-semibold">Install SpikeLedger</span>. Then
        turn on alerts from the installed app.
      </p>
    </div>
  );
}

// Icons sit inline in a sentence, nudged onto the text baseline.
const ICON = "inline-block align-[-3px] text-navy-800";

function Step({ n }: { n: number }) {
  return (
    <span className="stat-number flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
      {n}
    </span>
  );
}

// A sketch of Safari's bottom toolbar with the Share button called out, then
// the share sheet row to tap.
function IosIllustration() {
  const dim = "text-slate-400";
  return (
    <div aria-hidden className="flex flex-wrap items-end gap-3">
      <div className="w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 pb-2 pt-3">
        <div className="mb-2 h-6 rounded-md bg-white text-center text-[10px] leading-6 text-slate-400 shadow-sm">
          spikeledger.vercel.app
        </div>
        <div className="flex items-center justify-between px-1">
          <ChevronLeft size={18} className={dim} />
          <ChevronRight size={18} className={dim} />
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-navy-900">
            <Share size={17} strokeWidth={2.25} className="text-navy-900" />
          </span>
          <BookOpen size={18} className={dim} />
          <Copy size={18} className={dim} />
        </div>
      </div>
      <div className="w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 ring-2 ring-navy-900">
          Add to Home Screen
          <SquarePlus size={18} strokeWidth={2} className="text-navy-900" />
        </div>
      </div>
    </div>
  );
}
