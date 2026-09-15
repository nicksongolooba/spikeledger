"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import {
  currentSubscription,
  detectPlatform,
  disableMatchAlerts,
  enableMatchAlerts,
  isStandalone,
  pushSupported,
  type InstallPlatform,
} from "@/lib/push-client";
import { InstallInstructions } from "@/components/parent/InstallInstructions";

type DeviceState = "checking" | "on" | "off" | "blocked" | "needs-install" | "unsupported" | "not-configured";

// Parent settings: alerts on this device, and the email fallback switch.
export function MatchAlertsSettings({
  vapidPublicKey,
  emailMatchAlerts,
  activeDevices,
}: {
  vapidPublicKey: string | null;
  emailMatchAlerts: boolean;
  activeDevices: number;
}) {
  const [state, setState] = useState<DeviceState>("checking");
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [standalone, setStandalone] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState(activeDevices);
  const [email, setEmail] = useState(emailMatchAlerts);
  const [emailSaved, setEmailSaved] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setStandalone(isStandalone());
    if (!vapidPublicKey) return setState("not-configured");
    if (!pushSupported()) return setState(p === "ios" && !isStandalone() ? "needs-install" : "unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    currentSubscription()
      .then((sub) => setState(sub && Notification.permission === "granted" ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidPublicKey]);

  async function enable() {
    if (!vapidPublicKey) return;
    if (state === "needs-install") {
      setShowHow(true);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await enableMatchAlerts(vapidPublicKey);
    setBusy(false);
    if (result.ok) {
      setState("on");
      setDevices((d) => d + 1);
    } else if (result.reason === "denied") setState("blocked");
    else if (result.reason === "failed") setError(`Could not turn on alerts. ${result.message ?? ""}`.trim());
  }

  async function disable() {
    setBusy(true);
    await disableMatchAlerts();
    setBusy(false);
    setState("off");
    setDevices((d) => Math.max(0, d - 1));
  }

  async function saveEmail(next: boolean) {
    setEmail(next);
    setEmailSaved(false);
    const res = await fetch("/api/parent/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailMatchAlerts: next }),
    });
    if (res.ok) setEmailSaved(true);
    else setEmail(!next);
  }

  return (
    <section id="match-alerts" className="card mt-8 scroll-mt-20">
      <div className="border-b border-slate-200 px-5 py-3.5">
        <h2 className="font-display text-lg font-bold text-slate-900">Match alerts</h2>
      </div>
      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-slate-600">
          Get a notification the moment a match starts, then tap it to watch live. If alerts are
          not on, we email you instead.
        </p>

        <div className="flex flex-wrap items-center gap-3" data-alerts-device={state}>
          {state === "on" && (
            <>
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                <Check size={16} strokeWidth={2.5} className="text-green-700" aria-hidden />
                Alerts are on for this device.
              </span>
              <button type="button" onClick={disable} disabled={busy} className="btn-ghost px-2 py-1 text-xs">
                <BellOff size={14} strokeWidth={2} aria-hidden />
                Turn off on this device
              </button>
            </>
          )}
          {(state === "off" || state === "needs-install") && (
            <>
              <button type="button" onClick={enable} disabled={busy} className="btn-primary">
                <Bell size={16} strokeWidth={2} aria-hidden />
                {busy ? "Turning on…" : "Enable match alerts"}
              </button>
              {state === "off" && !standalone && (
                <button type="button" onClick={() => setShowHow((v) => !v)} className="btn-ghost px-2 py-1 text-xs">
                  {showHow ? "Hide install steps" : "Install on your home screen"}
                </button>
              )}
            </>
          )}
          {state === "blocked" && (
            <p className="text-slate-700">
              Notifications are blocked for SpikeLedger in this browser. Allow them in your browser or
              phone settings, then come back here.
            </p>
          )}
          {state === "unsupported" && (
            <p className="text-slate-700">This browser can&apos;t show match alerts, so we email you instead.</p>
          )}
          {state === "not-configured" && (
            <p className="text-slate-700">Match alerts are not set up yet, so we email you when a match starts.</p>
          )}
        </div>
        {error && <p className="text-red-700">{error}</p>}

        {showHow && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            {state === "needs-install" && (
              <p className="mb-3 text-slate-700">On iPhone and iPad, alerts work once SpikeLedger is on your home screen.</p>
            )}
            <InstallInstructions platform={platform} />
          </div>
        )}

        {devices > 0 && (
          <p className="text-xs text-slate-500">
            Alerts are on for {devices} {devices === 1 ? "device" : "devices"} on your account.
          </p>
        )}

        <label className="flex cursor-pointer items-start gap-3 border-t border-slate-100 pt-4">
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => void saveEmail(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-navy-900"
            data-email-alerts
          />
          <span>
            <span className="block font-semibold text-slate-900">Email me when a match starts if alerts are not on</span>
            <span className="block text-slate-600">
              You never get both. With alerts on, we skip the email.
              {emailSaved && <span className="ml-2 font-medium text-green-700">Saved</span>}
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
