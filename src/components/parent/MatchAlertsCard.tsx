"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Check } from "lucide-react";
import {
  currentSubscription,
  detectPlatform,
  enableMatchAlerts,
  isStandalone,
  pushSupported,
  readFlag,
  resyncMatchAlerts,
  writeFlag,
  type InstallPlatform,
} from "@/lib/push-client";
import { InstallInstructions } from "@/components/parent/InstallInstructions";

// Keyed by parent: a family tablet can be shared by two parent accounts.
const installDismissedKey = (parentId: string) => `spikeledger:install-card-dismissed:${parentId}`;
const permissionDismissedKey = (parentId: string) => `spikeledger:alerts-prompt-dismissed:${parentId}`;

type View = "none" | "install" | "installed" | "permission" | "enabled" | "blocked";

// Dashboard card for match alerts. In a browser tab it explains installing
// SpikeLedger to the home screen; opened as the installed app it asks for
// notification permission. Never a modal, always dismissible.
export function MatchAlertsCard({
  parentId,
  vapidPublicKey,
  dismissed,
  hasActivePush,
  emailMatchAlerts,
}: {
  parentId: string;
  vapidPublicKey: string | null;
  dismissed: boolean;
  hasActivePush: boolean;
  emailMatchAlerts: boolean;
}) {
  // Decided after mount: none of this is knowable on the server.
  const [view, setView] = useState<View>("none");
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vapidPublicKey) return;
    setPlatform(detectPlatform());
    let cancelled = false;
    (async () => {
      if (isStandalone() && pushSupported()) {
        const sub = await currentSubscription().catch(() => null);
        if (cancelled) return;
        if (sub && Notification.permission === "granted") {
          void resyncMatchAlerts(vapidPublicKey);
          return;
        }
        if (Notification.permission !== "denied" && !readFlag(permissionDismissedKey(parentId))) setView("permission");
        return;
      }
      if (!isStandalone() && !dismissed && !hasActivePush && !readFlag(installDismissedKey(parentId))) {
        setView("install");
        return;
      }
      if (pushSupported() && Notification.permission === "granted") void resyncMatchAlerts(vapidPublicKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [parentId, vapidPublicKey, dismissed, hasActivePush]);

  function rememberInstallDismissed() {
    writeFlag(installDismissedKey(parentId));
    void fetch("/api/parent/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installCardDismissed: true }),
    }).catch(() => undefined);
  }

  async function turnOn() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setError(null);
    const result = await enableMatchAlerts(vapidPublicKey);
    setBusy(false);
    if (result.ok) setView("enabled");
    else if (result.reason === "denied") setView("blocked");
    else if (result.reason === "failed") setError(`Could not turn on alerts. ${result.message ?? ""}`.trim());
  }

  if (view === "none") return null;

  if (view === "permission" || view === "enabled" || view === "blocked") {
    return (
      <section className="card mt-6 flex items-start gap-3 p-4" data-alerts-card={view}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy-900">
          {view === "enabled" ? <Check size={18} strokeWidth={2.5} aria-hidden /> : <Bell size={18} strokeWidth={2} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          {view === "permission" && (
            <>
              <p className="font-semibold text-slate-900">Turn on alerts so you know the moment the match starts.</p>
              {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={turnOn} disabled={busy} className="btn-primary">
                  {busy ? "Turning on…" : "Turn on alerts"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    writeFlag(permissionDismissedKey(parentId));
                    setView("none");
                  }}
                  className="btn-ghost"
                >
                  Not now
                </button>
              </div>
            </>
          )}
          {view === "enabled" && (
            <p className="font-semibold text-slate-900">Alerts are on. You will get a notification when a match starts.</p>
          )}
          {view === "blocked" && (
            <p className="text-sm text-slate-700">
              Alerts are blocked on this device. You can allow them for SpikeLedger in your settings.
              {emailMatchAlerts ? " Until then we will email you when a match starts." : ""}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="card mt-6 overflow-hidden" data-alerts-card={view}>
      <div className="flex items-start gap-3 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white">
          <BellRing size={20} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold leading-tight text-slate-900">
            Watch matches live from your home screen
          </h2>
          {view === "installed" ? (
            <p className="mt-2 text-sm text-slate-700">
              SpikeLedger is installed. Open it from your home screen and turn on alerts.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Add SpikeLedger to your home screen and you can turn on match alerts. You get a
                notification the moment the match starts, tap it, and you are watching live. No
                email, no digging through your inbox.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                If you skip this, we will email you when a match starts instead.
              </p>
              {expanded && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <InstallInstructions
                    platform={platform}
                    onInstalled={() => {
                      rememberInstallDismissed();
                      setView("installed");
                    }}
                  />
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {!expanded && (
                  <button type="button" onClick={() => setExpanded(true)} className="btn-primary">
                    Show me how
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    rememberInstallDismissed();
                    setView("none");
                  }}
                  className="btn-ghost"
                >
                  Maybe later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
