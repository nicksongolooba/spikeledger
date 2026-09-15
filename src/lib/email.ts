// Email transport (Resend REST API) and the match-start email. Server only.
//
// Env: RESEND_API_KEY (no key = no emails, never an error), EMAIL_FROM (an
// address on a domain verified in Resend; onboarding@resend.dev only
// delivers to the Resend account owner, which is fine for testing).

export type EmailResult = { ok: true; id: string | null } | { ok: false; statusCode?: number; message: string };

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Resend drops a repeat send with the same key, so a retried request can't
  // email a parent twice.
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export async function sendEmail(msg: OutgoingEmail): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, message: "email_not_configured" };
  // RESEND_API_URL only exists so tests can point at a local mock.
  const base = (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(msg.idempotencyKey ? { "Idempotency-Key": msg.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "SpikeLedger <onboarding@resend.dev>",
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        headers: msg.headers,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, statusCode: res.status, message: `${res.status}: ${detail}`.slice(0, 300) };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id ?? null };
  } catch (err) {
    return { ok: false, message: `network: ${(err as Error).message}`.slice(0, 300) };
  }
}

// ---------------------------------------------------------------------------
// Copy. Shared by the push notification and the email so both name only the
// parent's own children.
// ---------------------------------------------------------------------------

// "Sofia", "Sofia and Leo", "Sofia, Leo and Mia"
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function matchStartTitle(names: string[]): string {
  return `${joinNames(names)}'s match is starting`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function matchStartEmail(args: { names: string[]; opponent: string; watchUrl: string }) {
  const who = joinNames(args.names);
  // We don't know a player's pronouns, so the second line uses the name
  // (or "their" for siblings) where a person would write "her" or "his".
  const follow = args.names.length === 1 ? `${who}'s` : "their";
  const subject = matchStartTitle(args.names);
  const install =
    "You are getting this email because SpikeLedger is not installed on your phone. If you add it to your home screen, you can get instant alerts instead of emails. Open SpikeLedger, tap Share, then Add to Home Screen.";

  const text = [
    "Hi,",
    "",
    `${who}'s match against ${args.opponent} just started.`,
    "",
    `You can follow ${follow} stats live while the match is going on:`,
    `Watch live: ${args.watchUrl}`,
    "",
    install,
    "",
    "SpikeLedger",
  ].join("\n");

  const p = (content: string, extra = "") =>
    `<p style="margin:0 0 16px;${extra}">${content}</p>`;
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f6f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">
<tr><td style="padding:28px 28px 12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#0f172a;">
${p("Hi,")}
${p(`${escapeHtml(who)}&#39;s match against ${escapeHtml(args.opponent)} just started.`)}
${p(`You can follow ${escapeHtml(follow)} stats live while the match is going on:`, "margin-bottom:20px;")}
<p style="margin:0 0 24px;"><a href="${escapeHtml(args.watchUrl)}" style="display:inline-block;background:#0b1a33;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px;">Watch live</a></p>
${p(escapeHtml(install), "font-size:14px;line-height:21px;color:#475569;")}
${p("SpikeLedger", "margin-bottom:8px;")}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
