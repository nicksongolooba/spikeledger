"use client";

import { useSyncExternalStore } from "react";

// Is SpikeLedger already installed on this device?
//
// That is three different questions, and which one the browser can answer
// depends on where the page is open:
//
//   1. Are we running INSIDE the installed app? The display mode says so,
//      iOS Safari sets its own flag, and an Android app shell arrives with an
//      android-app:// referrer.
//   2. Is it installed, but this is an ordinary browser tab? Chromium answers
//      that with getInstalledRelatedApps(), which only works because the
//      manifest points back at itself through related_applications.
//   3. Did they install it while we were watching? The appinstalled event
//      fires once and never again, so it gets written down.
//
// iOS Safari in a normal tab can answer none of them. There the card is shown
// once, and carries an "I already installed it" link that writes the same flag
// by hand.
//
// Every install surface reads this one store, so a person who has installed
// the app is never asked to install it again from anywhere.

export type InstallState = "checking" | "installed" | "not-installed";

// Remembered across visits. Written by the appinstalled event, by a positive
// getInstalledRelatedApps answer, and by the manual "I already installed it".
export const INSTALLED_FLAG = "spikeledger:pwa-installed";

export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Private mode or blocked storage: detection falls back to the live checks.
  }
}

// Running as the installed app rather than in a browser tab.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)").matches === true;
  const iosSafari = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const androidShell =
    typeof document !== "undefined" && document.referrer.startsWith("android-app://");
  return displayMode || iosSafari || androidShell;
}

interface RelatedApp {
  id?: string;
  platform?: string;
  url?: string;
  version?: string;
}
type NavigatorWithRelated = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
};

function relatedAppsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as NavigatorWithRelated).getInstalledRelatedApps === "function"
  );
}

// Chromium on desktop and Android. Needs HTTPS and a manifest that lists this
// same PWA under related_applications, or it always answers "none".
async function relatedAppInstalled(): Promise<boolean> {
  const nav = navigator as NavigatorWithRelated;
  if (typeof nav.getInstalledRelatedApps !== "function") return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    // Only our own PWA counts. There is no app store build to confuse it with.
    return apps.some((app) => app.platform === "webapp");
  } catch {
    return false;
  }
}

let state: InstallState = "checking";
let started = false;
const listeners = new Set<() => void>();

function emit(next: InstallState) {
  if (state === next) return;
  state = next;
  listeners.forEach((l) => l());
}

// Called by the appinstalled event, by a positive related-apps answer, and by
// the "I already installed it" link.
export function markInstalled(): void {
  writeFlag(INSTALLED_FLAG);
  emit("installed");
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  // The cheap synchronous answers first, so the common cases never flicker.
  if (isStandalone() || readFlag(INSTALLED_FLAG)) {
    emit("installed");
    return;
  }
  if (!relatedAppsSupported()) {
    emit("not-installed");
    return;
  }
  // Stay "checking" until Chromium answers rather than showing a prompt for a
  // moment and pulling it back.
  void relatedAppInstalled().then((installed) =>
    installed ? markInstalled() : emit("not-installed"),
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("appinstalled", () => markInstalled());
  // Launching the installed app from this same page flips the display mode.
  window
    .matchMedia?.("(display-mode: standalone)")
    .addEventListener?.("change", (e) => {
      if (e.matches) markInstalled();
    });
}

// "checking" on the server and on the first client render, so no install
// prompt is ever part of the HTML.
export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (onChange) => {
      start();
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => state,
    () => "checking" as const,
  );
}

// Test seam: lets the verification script drive the store without a browser.
export function __resetInstallState() {
  state = "checking";
  started = false;
  listeners.clear();
}
