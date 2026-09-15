"use client";

import { useSyncExternalStore } from "react";

// Browser side of match alerts: platform detection, the install prompt, and
// the push subscription. Client components only.

export type InstallPlatform = "ios" | "android" | "desktop";

export function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // iPadOS reports a Mac user agent; touch support gives it away.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

// Opened from the home screen / as an installed app.
export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// iOS only exposes PushManager inside a home-screen web app (16.4+).
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

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
    // Private mode / blocked storage: the server copy is enough.
  }
}

// ---------------------------------------------------------------------------
// Install prompt (Chromium). The event can fire before React mounts, so it's
// captured as soon as this module loads and exposed through a tiny store.
// ---------------------------------------------------------------------------
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisVisit = false;
let snapshot = { canInstall: false, installed: false };
const listeners = new Set<() => void>();
function emit() {
  snapshot = { canInstall: deferredPrompt !== null, installed: installedThisVisit };
  listeners.forEach((l) => l());
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedThisVisit = true;
    emit();
  });
}
const serverSnapshot = { canInstall: false, installed: false };

export function useInstallPrompt() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => serverSnapshot,
  );
  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    const e = deferredPrompt;
    if (!e) return "unavailable";
    await e.prompt();
    const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    deferredPrompt = null;
    if (choice.outcome === "accepted") installedThisVisit = true;
    emit();
    return choice.outcome;
  }
  return { ...state, promptInstall };
}

// ---------------------------------------------------------------------------
// Push subscription
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return true; // browser doesn't expose it: assume unchanged
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms)),
  ]);
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js");
  return withTimeout(navigator.serviceWorker.ready, 15_000, "Service worker");
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

function postSubscription(sub: PushSubscription, renewed = false) {
  return fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...sub.toJSON(), renewed }),
  });
}

async function saveSubscription(reg: ServiceWorkerRegistration, sub: PushSubscription, key: Uint8Array<ArrayBuffer>) {
  let res = await postSubscription(sub);
  if (res.status === 409) {
    // We told the server this endpoint died: get a fresh one, once.
    await sub.unsubscribe().catch(() => undefined);
    const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    res = await postSubscription(fresh, true);
  }
  return res;
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "dismissed" | "failed"; message?: string };

// Must run from a tap (iOS only shows the permission prompt for a user gesture).
export async function enableMatchAlerts(vapidPublicKey: string): Promise<EnableResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission === "denied") return { ok: false, reason: "denied" };
  if (permission !== "granted") return { ok: false, reason: "dismissed" };
  try {
    const reg = await readyRegistration();
    const key = urlBase64ToUint8Array(vapidPublicKey);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, key)) {
      await sub.unsubscribe().catch(() => undefined);
      sub = null;
    }
    sub = sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
    const res = await saveSubscription(reg, sub, key);
    if (!res.ok) return { ok: false, reason: "failed", message: `The server answered ${res.status}.` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "failed", message: (err as Error).message };
  }
}

export async function disableMatchAlerts(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

// Quietly re-register this device's subscription (keeps the server copy
// active and attached to whoever is signed in). No prompts.
export async function resyncMatchAlerts(vapidPublicKey: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (reg && sub) await saveSubscription(reg, sub, urlBase64ToUint8Array(vapidPublicKey));
  } catch {
    // Next visit tries again.
  }
}
