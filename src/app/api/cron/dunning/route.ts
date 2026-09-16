import { NextResponse } from "next/server";
import { sendDueDunningEmails } from "@/lib/dunning";

// GET /api/cron/dunning
//
// The three-day and six-day payment reminders. Point a scheduler at this once
// a day; on Vercel that is a cron entry. Guarded by CRON_SECRET, sent either
// as a bearer token or as ?key=, because different schedulers do it
// differently. Safe to call as often as you like: each account gets each
// reminder once.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set on this server." }, { status: 503 });
  }
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer !== secret && url.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sent = await sendDueDunningEmails();
  console.info(`[billing] dunning sweep sent ${sent} reminder(s)`);
  return NextResponse.json({ ok: true, sent });
}
