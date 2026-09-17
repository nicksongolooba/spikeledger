import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendDueDunningEmails } from "@/lib/dunning";

// GET /api/cron/dunning
//
// The three-day and six-day payment reminders. vercel.json runs this once a
// day; Vercel sends `Authorization: Bearer $CRON_SECRET` on its own when that
// environment variable is set, which is the header checked below.
//
// Nothing without the secret gets through, and the answer to a wrong secret is
// a plain 404: an attacker learns nothing about whether the route exists.
//
// Safe to call as often as you like. Each account gets each reminder once,
// which is enforced in sendDunningEmailIfDue rather than here.
export const dynamic = "force-dynamic";

// Constant time, so the response time cannot be used to guess the secret one
// character at a time.
function secretMatches(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Nothing runs until the secret is configured. Failing closed is the point.
    console.error("[billing] dunning cron called but CRON_SECRET is not set");
    return NextResponse.json({ error: "CRON_SECRET is not set on this server." }, { status: 503 });
  }

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  // The query fallback exists for schedulers that cannot send a header. Prefer
  // the header: a secret in a URL ends up in access logs.
  const queryKey = new URL(req.url).searchParams.get("key");

  if (!secretMatches(bearer, secret) && !secretMatches(queryKey, secret)) {
    console.warn("[billing] dunning cron rejected: missing or wrong CRON_SECRET");
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sent = await sendDueDunningEmails();
  console.info(`[billing] dunning sweep sent ${sent} reminder(s)`);
  return NextResponse.json({ ok: true, sent });
}
