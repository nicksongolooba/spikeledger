// Match-start alerts verification, against the real database and the real
// lib code. Throwaway users use @notify-test.local and are deleted at the end.
//
// Part A drives the notification engine with recording transports, so every
// rule is checked exactly: push only / email only / expired push -> email /
// never both / starters only / no duplicates / 10-minute limit / toggles and
// preferences / no other players' names.
// Part B checks the real transports end to end against local mock services:
// web-push to an HTTPS push service (payload decrypted, VAPID JWT verified)
// and the Resend request.
//
// Run: node --import tsx scripts/verify-match-notifications.mts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import http from "node:http";
import https from "node:https";
import { createECDH, createPublicKey, randomBytes, verify as verifySig } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { prisma } from "@/lib/prisma";
import { NOTIFY_RATE_WINDOW_MS, notifyMatchStart, startMatch, type NotificationTransports } from "@/lib/match-notifications";
import { isAllowedPushEndpoint, sendPush, type PushMessage } from "@/lib/push";
import { matchStartEmail, sendEmail, type OutgoingEmail } from "@/lib/email";
import { buildLiveSnapshot, matchStatus } from "@/lib/parent-view";
import { invalidateLive } from "@/lib/live-cache";

const require = createRequire(import.meta.url);
const ece = require("http_ece") as { decrypt: (buf: Buffer, params: Record<string, unknown>) => Buffer };

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail !== undefined ? ` :: ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  }
}

const run = Date.now().toString(36);
const email = (who: string) => `${who}-${run}@notify-test.local`;
const fcm = (who: string) => `https://fcm.googleapis.com/fcm/send/${run}-${who}`;

function recorder(opts: { gone?: string[]; broken?: string[]; pushEnabled?: boolean; emailEnabled?: boolean } = {}) {
  const pushes: { endpoint: string; message: PushMessage }[] = [];
  const emails: OutgoingEmail[] = [];
  const transports: NotificationTransports = {
    pushEnabled: () => opts.pushEnabled ?? true,
    emailEnabled: () => opts.emailEnabled ?? true,
    async push(target, message) {
      pushes.push({ endpoint: target.endpoint, message });
      if (opts.gone?.includes(target.endpoint)) return { ok: false, gone: true, statusCode: 410, message: "410: push subscription has unsubscribed or expired" };
      if (opts.broken?.includes(target.endpoint)) return { ok: false, gone: false, statusCode: 500, message: "500: push service error" };
      return { ok: true };
    },
    async email(message) {
      emails.push(message);
      return { ok: true, id: `fake-${emails.length}` };
    },
  };
  return { transports, pushes, emails };
}

const hasDash = (s: string) => /[–—]/.test(s);

async function main() {
  const coach = await prisma.user.create({ data: { email: email("coach"), name: "Coach", passwordHash: "x", role: "COACH" } });
  const mkParent = (who: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { email: email(who), name: who, passwordHash: "x", role: "PARENT", ...extra } });
  const cleanup: string[] = [coach.id];

  try {
    const team = await prisma.team.create({ data: { name: "Venom Volt 16U", ageGroup: "16U", coachId: coach.id } });
    const names = ["Sofia", "Liam", "Noah", "Mia", "Zoe", "Eli", "Ava", "Priya", "Tess", "Kai", "Lena", "Nia", "Jade", "Omar", "Ruby"];
    const P: Record<string, { id: string; name: string }> = {};
    for (const [i, n] of names.entries()) {
      P[n] = await prisma.player.create({
        data: { teamId: team.id, name: n, number: i + 1, primaryPosition: "OH", isActive: n !== "Kai" },
      });
    }
    const link = (parentId: string, ...kids: string[]) =>
      prisma.parentPlayerLink.createMany({ data: kids.map((k) => ({ parentId, playerId: P[k].id })) });
    const sub = (parentId: string, endpoint: string) =>
      prisma.pushSubscription.create({ data: { parentId, endpoint, p256dh: "BPk" + "x".repeat(84), auth: "authsecret123" } });

    const pPush = await mkParent("push"); await link(pPush.id, "Sofia"); await sub(pPush.id, fcm("push"));
    const pEmail = await mkParent("email"); await link(pEmail.id, "Liam");
    const pExpired = await mkParent("expired"); await link(pExpired.id, "Noah"); const expiredSub = await sub(pExpired.id, fcm("expired"));
    const pSiblings = await mkParent("siblings"); await link(pSiblings.id, "Mia", "Zoe"); await sub(pSiblings.id, fcm("siblings"));
    const pOptOut = await mkParent("optout", { emailMatchAlerts: false }); await link(pOptOut.id, "Eli");
    const pBench = await mkParent("bench"); await link(pBench.id, "Ava");
    const pMulti = await mkParent("multi"); await link(pMulti.id, "Priya");
    const multiGone = await sub(pMulti.id, fcm("multi-old")); const multiOk = await sub(pMulti.id, fcm("multi-new"));
    const pTransient = await mkParent("transient"); await link(pTransient.id, "Tess"); const transientSub = await sub(pTransient.id, fcm("transient"));
    const pInactive = await mkParent("inactive"); await link(pInactive.id, "Kai");
    const pLate = await mkParent("late"); await link(pLate.id, "Lena");
    cleanup.push(pPush.id, pEmail.id, pExpired.id, pSiblings.id, pOptOut.id, pBench.id, pMulti.id, pTransient.id, pInactive.id, pLate.id);
    const parentName = new Map([
      [pPush.id, ["Sofia"]], [pEmail.id, ["Liam"]], [pExpired.id, ["Noah"]], [pSiblings.id, ["Mia", "Zoe"]],
      [pOptOut.id, ["Eli"]], [pBench.id, ["Ava"]], [pMulti.id, ["Priya"]], [pTransient.id, ["Tess"]],
    ]);

    const tournament = await prisma.tournament.create({ data: { teamId: team.id, name: "Fall Classic", startDate: new Date() } });
    const mkMatch = (n: number, opponent = "Central Thunder") =>
      prisma.match.create({ data: { tournamentId: tournament.id, opponent, matchNumber: n } });
    const rows = (matchId: string) => prisma.matchNotification.findMany({ where: { matchId } });

    // ------------------------------------------------------------------ A1
    console.log("A1. Start match: who gets what");
    const m1 = await mkMatch(1);
    const lineup = ["Sofia", "Liam", "Noah", "Mia", "Zoe", "Eli", "Priya", "Tess", "Kai"].map((n) => P[n].id);
    const r1 = recorder({ gone: [fcm("expired"), fcm("multi-old")], broken: [fcm("transient")] });
    const s1 = await startMatch(m1.id, lineup, { transports: r1.transports });
    check("first start marks the match started", s1.firstStart && (await prisma.match.findUnique({ where: { id: m1.id } }))?.startedAt instanceof Date);
    check("6 parents notified (3 push, 3 email), 1 skipped", s1.notified === 6 && s1.push === 3 && s1.email === 3 && s1.skipped === 1, s1);

    const pushedTo = (endpoint: string) => r1.pushes.filter((p) => p.endpoint === endpoint);
    const emailedTo = (addr: string) => r1.emails.filter((e) => e.to === addr);

    check("push parent: exactly one push", pushedTo(fcm("push")).length === 1);
    check("push parent: no email", emailedTo(pPush.email).length === 0);
    const sofiaPush = pushedTo(fcm("push"))[0]?.message;
    check("push title reads \"Sofia's match is starting\"", sofiaPush?.title === "Sofia's match is starting", sofiaPush);
    check("push body reads \"Venom Volt 16U vs Central Thunder. Tap to watch live.\"", sofiaPush?.body === "Venom Volt 16U vs Central Thunder. Tap to watch live.", sofiaPush);
    check("push opens /parent/player/[playerId] with the app icon", sofiaPush?.url === `/parent/player/${P.Sofia.id}` && sofiaPush.icon === "/icons/icon-192.png");

    check("email parent: exactly one email", emailedTo(pEmail.email).length === 1);
    check("email parent: no push attempted", !r1.pushes.some((p) => p.endpoint.includes("-email")));
    const liamEmail = emailedTo(pEmail.email)[0];
    check("email subject reads \"Liam's match is starting\"", liamEmail?.subject === "Liam's match is starting");
    const expectedText = [
      "Hi,",
      "",
      "Liam's match against Central Thunder just started.",
      "",
      "You can follow Liam's stats live while the match is going on:",
      `Watch live: ${(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "")}/parent/player/${P.Liam.id}`,
      "",
      "You are getting this email because SpikeLedger is not installed on your phone. If you add it to your home screen, you can get instant alerts instead of emails. Open SpikeLedger, tap Share, then Add to Home Screen.",
      "",
      "SpikeLedger",
    ].join("\n");
    check("email text matches the agreed copy", liamEmail?.text === expectedText, liamEmail?.text);
    check("email html has the Watch live button to the player page", /href="[^"]*\/parent\/player\/[^"]+"[^>]*>Watch live<\/a>/.test(liamEmail?.html ?? ""));
    check("email has no em/en dashes or exclamation marks", !hasDash(liamEmail?.subject + liamEmail?.text + liamEmail?.html) && !/!/.test(liamEmail?.text ?? "") && !/!(?!doctype)/i.test(liamEmail?.html ?? ""));
    check("email carries an idempotency key per match and parent", liamEmail?.idempotencyKey === `match-start-${m1.id}-${pEmail.id}`);

    check("expired push: push attempted, then one email", pushedTo(fcm("expired")).length === 1 && emailedTo(pExpired.email).length === 1);
    const expiredRow = await prisma.pushSubscription.findUnique({ where: { id: expiredSub.id } });
    check("expired push: subscription marked inactive with expiredAt", expiredRow?.active === false && expiredRow.expiredAt instanceof Date);

    check("siblings: one push naming both children", pushedTo(fcm("siblings")).length === 1 && pushedTo(fcm("siblings"))[0].message.title === "Mia and Zoe's match is starting");
    check("siblings: no email", emailedTo(pSiblings.email).length === 0);

    check("two devices, one gone: push only, no email", pushedTo(fcm("multi-old")).length === 1 && pushedTo(fcm("multi-new")).length === 1 && emailedTo(pMulti.email).length === 0);
    const [mOld, mNew] = await Promise.all([
      prisma.pushSubscription.findUnique({ where: { id: multiGone.id } }),
      prisma.pushSubscription.findUnique({ where: { id: multiOk.id } }),
    ]);
    check("two devices: the gone one is inactive, the working one recorded a success", mOld?.active === false && mNew?.active === true && mNew.lastSuccessAt instanceof Date);

    check("push service error: falls back to one email", pushedTo(fcm("transient")).length === 1 && emailedTo(pTransient.email).length === 1);
    const tRow = await prisma.pushSubscription.findUnique({ where: { id: transientSub.id } });
    check("push service error: device kept active, error recorded", tRow?.active === true && (tRow.lastError ?? "").startsWith("500"));

    check("email opt-out without push: nothing sent", emailedTo(pOptOut.email).length === 0);
    check("bench player's parent: nothing sent", emailedTo(pBench.email).length === 0);
    check("player no longer on the roster: nothing sent", emailedTo(pInactive.email).length === 0);

    // Never both, for every parent.
    const endpointsByParent = new Map<string, string[]>([
      [pPush.id, [fcm("push")]], [pExpired.id, [fcm("expired")]], [pSiblings.id, [fcm("siblings")]],
      [pMulti.id, [fcm("multi-old"), fcm("multi-new")]], [pTransient.id, [fcm("transient")]],
    ]);
    const gone = new Set([fcm("expired"), fcm("multi-old"), fcm("transient")]);
    const all = [pPush, pEmail, pExpired, pSiblings, pOptOut, pBench, pMulti, pTransient, pInactive];
    const both = all.filter((p) => {
      const delivered = (endpointsByParent.get(p.id) ?? []).some((e) => pushedTo(e).length > 0 && !gone.has(e));
      return delivered && emailedTo(p.email).length > 0;
    });
    check("no parent got both a push and an email", both.length === 0, both.map((p) => p.email));

    // No other player's name anywhere a parent can see.
    const leaks: string[] = [];
    for (const [parentId, own] of parentName) {
      const parent = all.find((p) => p.id === parentId)!;
      const texts = [
        ...(endpointsByParent.get(parentId) ?? []).flatMap((e) => pushedTo(e).map((p) => JSON.stringify(p.message))),
        ...emailedTo(parent.email).map((e) => e.subject + e.text + e.html),
      ].join(" ");
      for (const n of names) if (!own.includes(n) && new RegExp(`\\b${n}\\b`).test(texts)) leaks.push(`${parent.email} saw ${n}`);
    }
    check("no alert mentions another player", leaks.length === 0, leaks);

    const m1rows = await rows(m1.id);
    check("one log row per considered parent (7), none for bench/inactive", m1rows.length === 7 && !m1rows.some((r) => r.parentId === pBench.id || r.parentId === pInactive.id));
    check("log rows record channel and outcome", m1rows.filter((r) => r.status === "SENT").length === 6 && m1rows.find((r) => r.parentId === pOptOut.id)?.reason === "email_opted_out" && m1rows.find((r) => r.parentId === pExpired.id)?.channel === "EMAIL");

    // ------------------------------------------------------------------ A2
    console.log("A2. No duplicates");
    const r2 = recorder();
    const s2 = await startMatch(m1.id, lineup, { transports: r2.transports });
    check("pressing Start match again alerts nobody", s2.notified === 0 && s2.duplicates === 7 && r2.pushes.length + r2.emails.length === 0, s2);
    const r3 = recorder();
    const s3 = await startMatch(m1.id, [...lineup, P.Ava.id], { transports: r3.transports });
    check("lineup fixed before the first point: only the new starter's parent is alerted", s3.notified === 1 && r3.emails.length === 1 && r3.emails[0].to === pBench.email && r3.pushes.length === 0, s3);
    await prisma.matchSetScore.create({ data: { matchId: m1.id, setNumber: 1, us: 1, them: 0, history: [[0, 0], [1, 0]] } });
    const r4 = recorder();
    const s4 = await startMatch(m1.id, [...lineup, P.Lena.id], { transports: r4.transports });
    check("once a point is scored, lineup changes alert nobody", s4.reason === "already_underway" && r4.emails.length + r4.pushes.length === 0 && !(await rows(m1.id)).some((r) => r.parentId === pLate.id), s4);

    const pC1 = await mkParent("concurrent-push"); await link(pC1.id, "Nia"); await sub(pC1.id, fcm("concurrent"));
    const pC2 = await mkParent("concurrent-email"); await link(pC2.id, "Jade");
    cleanup.push(pC1.id, pC2.id);
    const m2 = await mkMatch(2, "Metro Tigers");
    const r5 = recorder();
    const l2 = [P.Nia.id, P.Jade.id];
    await Promise.all([
      startMatch(m2.id, l2, { transports: r5.transports }),
      startMatch(m2.id, l2, { transports: r5.transports }),
      notifyMatchStart(m2.id, l2, { transports: r5.transports }),
      notifyMatchStart(m2.id, l2, { transports: r5.transports }),
    ]);
    check("four simultaneous starts: one push and one email in total", r5.pushes.length === 1 && r5.emails.length === 1, { pushes: r5.pushes.length, emails: r5.emails.length });
    check("four simultaneous starts: one log row per parent", (await rows(m2.id)).length === 2);

    // ------------------------------------------------------------------ A3
    console.log("A3. At most one alert per parent per 10 minutes");
    const m3 = await mkMatch(3, "Summit Spikers");
    const r6 = recorder();
    const s6 = await notifyMatchStart(m3.id, [P.Liam.id], { transports: r6.transports });
    check("second match minutes later: parent is rate limited", s6.notified === 0 && s6.skipped === 1 && r6.emails.length === 0);
    check("rate-limited row says why", (await rows(m3.id))[0]?.reason === "rate_limited");
    await prisma.matchNotification.updateMany({
      where: { parentId: pEmail.id, status: "SENT" },
      data: { createdAt: new Date(Date.now() - NOTIFY_RATE_WINDOW_MS - 60_000) },
    });
    const m4 = await mkMatch(4, "Coastal Crush");
    const r7 = recorder();
    const s7 = await notifyMatchStart(m4.id, [P.Liam.id], { transports: r7.transports });
    check("after 10 minutes the next match alerts again", s7.notified === 1 && r7.emails.length === 1);

    // ------------------------------------------------------------------ A4
    console.log("A4. Team switches and preferences");
    const pSwitch = await mkParent("switch"); await link(pSwitch.id, "Omar"); cleanup.push(pSwitch.id);
    await prisma.team.update({ where: { id: team.id }, data: { notifyParentsOnStart: false } });
    const m5 = await mkMatch(5);
    const r8 = recorder();
    const s8 = await startMatch(m5.id, [P.Omar.id], { transports: r8.transports });
    check("\"Notify parents when matches start\" off: nobody alerted", s8.reason === "notifications_off" && r8.emails.length === 0);
    await prisma.team.update({ where: { id: team.id }, data: { notifyParentsOnStart: true, allowParentView: false } });
    const s9 = await notifyMatchStart(m5.id, [P.Omar.id], { transports: r8.transports });
    check("\"Allow parent live view\" off: nobody alerted", s9.reason === "parent_view_off" && r8.emails.length === 0);
    await prisma.team.update({ where: { id: team.id }, data: { allowParentView: true } });
    const m6 = await prisma.match.create({ data: { tournamentId: tournament.id, opponent: "Old Match", matchNumber: 6, result: "WIN" } });
    check("finished match: nobody alerted", (await startMatch(m6.id, [P.Omar.id], { transports: r8.transports })).reason === "match_finished");

    const pNoVapid = await mkParent("novapid"); await link(pNoVapid.id, "Ruby"); await sub(pNoVapid.id, fcm("novapid")); cleanup.push(pNoVapid.id);
    const m7 = await mkMatch(7);
    const r9 = recorder({ pushEnabled: false });
    const s10 = await notifyMatchStart(m7.id, [P.Ruby.id], { transports: r9.transports });
    check("push not configured on the server: email instead", s10.email === 1 && r9.pushes.length === 0 && r9.emails.length === 1);
    const m8 = await mkMatch(8);
    const pNoEmail = await mkParent("noemail"); await link(pNoEmail.id, "Omar"); cleanup.push(pNoEmail.id);
    const r10 = recorder({ emailEnabled: false });
    await prisma.parentPlayerLink.deleteMany({ where: { parentId: pSwitch.id } });
    const s11 = await notifyMatchStart(m8.id, [P.Omar.id], { transports: r10.transports });
    check("no email service configured: skipped quietly", s11.skipped === 1 && s11.failed === 0 && (await rows(m8.id))[0]?.reason === "email_not_configured");
    const savedKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const m9 = await mkMatch(9);
    await prisma.matchNotification.deleteMany({ where: { parentId: pNoEmail.id } });
    let threw = false;
    try {
      const real = await notifyMatchStart(m9.id, [P.Omar.id]);
      check("real transports without RESEND_API_KEY: no crash, recorded as skipped", real.skipped === 1 && real.failed === 0, real);
    } catch (e) {
      threw = true;
      console.error(e);
    }
    check("real transports without RESEND_API_KEY: nothing thrown", !threw);
    if (savedKey) process.env.RESEND_API_KEY = savedKey;

    // ------------------------------------------------------------------ A5
    console.log("A5. Started matches are what parents see");
    const now = Date.now();
    check("a match created days ago but started now is live", matchStatus({ result: null, createdAt: new Date(now - 3 * 86400000), startedAt: new Date(now) }, false, now) === "live");
    const team2 = await prisma.team.create({ data: { name: "Sched Test", coachId: coach.id } });
    const kid = await prisma.player.create({ data: { teamId: team2.id, name: "Wren", number: 1, primaryPosition: "OH" } });
    const t2 = await prisma.tournament.create({ data: { teamId: team2.id, name: "Cup", startDate: new Date() } });
    const early = await prisma.match.create({ data: { tournamentId: t2.id, opponent: "First", matchNumber: 1, createdAt: new Date(now - 2 * 86400000) } });
    await prisma.match.create({ data: { tournamentId: t2.id, opponent: "Second", matchNumber: 2 } });
    invalidateLive({ teamId: team2.id });
    check("before starting, the parent view shows the last scheduled match", (await buildLiveSnapshot(kid.id)).match?.opponent === "Second");
    await startMatch(early.id, [kid.id], { transports: recorder().transports });
    invalidateLive({ teamId: team2.id });
    const snap = await buildLiveSnapshot(kid.id);
    check("after Start match, the parent view follows the started match, live", snap.match?.id === early.id && snap.status === "live", snap.match);

    // ------------------------------------------------------------------ B1
    console.log("B1. Real web push to a local HTTPS push service");
    check("allowlist accepts real push services", ["https://fcm.googleapis.com/fcm/send/abc", "https://web.push.apple.com/QK", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://wns2-par02p.notify.windows.com/w/?token=x"].every(isAllowedPushEndpoint));
    check("allowlist rejects other hosts, http, and look-alikes", !["https://evil.example.com/x", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.com/x", "https://localhost/x"].some(isAllowedPushEndpoint));

    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      check("VAPID keys available for the real push check (.env.local)", false);
    } else {
      const dir = mkdtempSync(join(tmpdir(), "push-mock-"));
      execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"), "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], { stdio: "ignore" });
      const cert = readFileSync(join(dir, "cert.pem"));
      https.globalAgent.options.ca = [cert];
      process.env.PUSH_EXTRA_ENDPOINT_HOSTS = "localhost";

      const received: { path: string; headers: http.IncomingHttpHeaders; body: Buffer }[] = [];
      const server = https.createServer({ key: readFileSync(join(dir, "key.pem")), cert }, (req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          received.push({ path: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) });
          res.writeHead(req.url?.includes("gone") ? 410 : 201).end();
        });
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      const port = (server.address() as AddressInfo).port;

      const receiver = createECDH("prime256v1");
      receiver.generateKeys();
      const authSecret = randomBytes(16);
      const target = { endpoint: `https://localhost:${port}/push/ok`, p256dh: receiver.getPublicKey().toString("base64url"), auth: authSecret.toString("base64url") };
      const message: PushMessage = { title: "Sofia's match is starting", body: "Venom Volt 16U vs Central Thunder. Tap to watch live.", url: `/parent/player/${P.Sofia.id}`, icon: "/icons/icon-192.png", tag: `match-start-${m1.id}` };
      const ok = await sendPush(target, message);
      check("push service accepted the message", ok.ok, ok);
      const got = received.find((r) => r.path === "/push/ok");
      check("sent as aes128gcm with TTL and high urgency", got?.headers["content-encoding"] === "aes128gcm" && got.headers.ttl === "1200" && got.headers.urgency === "high", got?.headers);
      let decoded: unknown = null;
      try {
        decoded = JSON.parse(ece.decrypt(got!.body, { version: "aes128gcm", privateKey: receiver, authSecret }).toString("utf8"));
      } catch (e) {
        decoded = String(e);
      }
      check("payload decrypts with the subscription keys to the exact message", JSON.stringify(decoded) === JSON.stringify(message), decoded);

      const auth = String(got?.headers.authorization ?? "");
      const m = /^vapid t=([^,]+), k=(.+)$/.exec(auth);
      check("VAPID header carries our public key", m?.[2] === process.env.VAPID_PUBLIC_KEY);
      if (m) {
        const [h, p, s] = m[1].split(".");
        const claims = JSON.parse(Buffer.from(p, "base64url").toString());
        const raw = Buffer.from(process.env.VAPID_PUBLIC_KEY!, "base64url");
        const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33, 65).toString("base64url") }, format: "jwk" });
        const valid = verifySig("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
        check("VAPID JWT signature verifies with the public key", valid);
        check("VAPID JWT audience is the push service origin, subject set", claims.aud === `https://localhost:${port}` && typeof claims.sub === "string" && claims.exp * 1000 > Date.now(), claims);
      }
      const goneResult = await sendPush({ ...target, endpoint: `https://localhost:${port}/push/gone` }, message);
      check("a 410 from the push service is reported as gone", !goneResult.ok && goneResult.gone && goneResult.statusCode === 410, goneResult);
      server.close();
      delete process.env.PUSH_EXTRA_ENDPOINT_HOSTS;
    }

    // ------------------------------------------------------------------ B2
    console.log("B2. Real Resend request against a local mock");
    const mails: { path: string; headers: http.IncomingHttpHeaders; body: Record<string, unknown> }[] = [];
    let failNext = false;
    const resend = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        mails.push({ path: req.url ?? "", headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString() || "{}") });
        if (failNext) {
          failNext = false;
          res.writeHead(422, { "Content-Type": "application/json" }).end(JSON.stringify({ message: "bad from" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ id: "email_123" }));
      });
    });
    await new Promise<void>((r) => resend.listen(0, "127.0.0.1", r));
    const saved = { key: process.env.RESEND_API_KEY, url: process.env.RESEND_API_URL, from: process.env.EMAIL_FROM };
    process.env.RESEND_API_KEY = "re_test_123";
    process.env.RESEND_API_URL = `http://127.0.0.1:${(resend.address() as AddressInfo).port}`;
    process.env.EMAIL_FROM = "SpikeLedger <alerts@spikeledger.test>";
    const content = matchStartEmail({ names: ["Sofia"], opponent: "Central Thunder", watchUrl: "https://spikeledger.vercel.app/parent/player/abc" });
    const sent = await sendEmail({ to: "parent@example.com", ...content, idempotencyKey: "match-start-m-p", headers: { "List-Unsubscribe": "<https://spikeledger.vercel.app/parent/settings#match-alerts>" } });
    const req0 = mails[0];
    check("Resend call succeeds and returns the id", sent.ok && sent.id === "email_123", sent);
    check("POST /emails with the API key and idempotency key", req0?.path === "/emails" && req0.headers.authorization === "Bearer re_test_123" && req0.headers["idempotency-key"] === "match-start-m-p");
    check("body has from, to, subject, text and html", req0?.body.from === "SpikeLedger <alerts@spikeledger.test>" && JSON.stringify(req0.body.to) === '["parent@example.com"]' && req0.body.subject === "Sofia's match is starting" && typeof req0.body.text === "string" && typeof req0.body.html === "string");
    check("html escapes coach-entered text", matchStartEmail({ names: ["Sofia"], opponent: "<b>Tigers</b>", watchUrl: "https://x/y" }).html.includes("&lt;b&gt;Tigers&lt;/b&gt;"));
    failNext = true;
    const bad = await sendEmail({ to: "parent@example.com", ...content });
    check("a Resend error comes back as a failure, not a throw", !bad.ok && bad.statusCode === 422, bad);
    resend.close();
    for (const [k, v] of [["RESEND_API_KEY", saved.key], ["RESEND_API_URL", saved.url], ["EMAIL_FROM", saved.from]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: cleanup } } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
