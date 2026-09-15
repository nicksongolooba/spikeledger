import webpush from "web-push";

// Web push transport (VAPID). Server only.
//
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT. Generate a pair once
// with `npx web-push generate-vapid-keys` and keep it stable: a new pair
// invalidates every existing browser subscription.

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// What the service worker receives (public/sw.js `push` handler).
export interface PushMessage {
  title: string;
  body: string;
  url: string; // opened on tap
  icon: string;
  tag: string; // repeats for the same match replace, never stack
}

export type PushResult =
  | { ok: true }
  | { ok: false; gone: boolean; statusCode?: number; message: string };

export function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT || "mailto:support@spikeledger.com",
  };
}

export function pushConfigured(): boolean {
  return vapidConfig() !== null;
}

// The server POSTs to whatever endpoint a browser registered, so only accept
// the real push services. PUSH_EXTRA_ENDPOINT_HOSTS (comma separated) exists
// for local testing against a mock push service; leave it unset in production.
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge on Android, Samsung Internet, Opera, Brave
  "push.apple.com", // Safari and home-screen web apps on iOS / macOS
  "push.services.mozilla.com", // Firefox
  "notify.windows.com", // Edge on Windows
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const extra = (process.env.PUSH_EXTRA_ENDPOINT_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return [...PUSH_SERVICE_HOSTS, ...extra].some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
}

export async function sendPush(target: PushTarget, message: PushMessage): Promise<PushResult> {
  const vapid = vapidConfig();
  if (!vapid) return { ok: false, gone: false, message: "push_not_configured" };
  if (!isAllowedPushEndpoint(target.endpoint)) {
    return { ok: false, gone: true, message: "endpoint_not_allowed" };
  }
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message),
      {
        vapidDetails: vapid,
        // A "match is starting" alert is useless an hour later.
        TTL: 20 * 60,
        urgency: "high",
        timeout: 8000,
      },
    );
    return { ok: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    return {
      ok: false,
      // 404/410: the subscription expired or the user revoked permission.
      gone: statusCode === 404 || statusCode === 410,
      statusCode,
      message: `${statusCode ?? "network"}: ${(err as Error).message}`.slice(0, 300),
    };
  }
}
