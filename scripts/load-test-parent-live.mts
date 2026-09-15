// Load test for the parent live view poll (/api/parent/live).
//
// Simulates N parents watching ONE live match the way the real page does:
// each polls every 15 seconds with If-None-Match, staggered so the load is
// spread out, while a coach scores a point every 20 seconds (each write
// invalidates the cache). Reports requests by status, the 304 share, latency,
// and - when DEV_LOG points at the dev server's log - how many Prisma queries
// ran during the window (the dev server logs every query).
//
//   npm run dev > /tmp/spikeledger-dev.log 2>&1 &
//   DEV_LOG=/tmp/spikeledger-dev.log node --import tsx scripts/load-test-parent-live.mts --parents 200 --seconds 120
//
// Creates throwaway users (@loadtest.local) and deletes them in a finally.
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const arg = (name: string, dflt: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : dflt;
};
const PARENTS = arg("parents", 200);
const SECONDS = arg("seconds", 120);
const WRITE_EVERY = arg("write-every", 20); // seconds between coach writes; 0 = a quiet spell (no writes)
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DEV_LOG = process.env.DEV_LOG;
const POLL_MS = 15_000;
const WRITE_MS = WRITE_EVERY * 1000;
// One cache refill is 9 Prisma queries: team context 5 (team, players,
// parent links, latest match, finished-match record) + match 4 (match,
// tournament, stat lines, set scores). Relations load as separate queries.
const REFILL_QUERIES = 9;
// The endpoint this replaces ran, per poll: the parent-link gate (3 queries)
// plus a fresh snapshot (player + team, match with tournament / stat lines /
// set scores / count, finished-match record) - about 10 queries.
const OLD_QUERIES_PER_POLL = 10;
const PASSWORD = "LoadTest-2026!";
const run = Date.now().toString(36);
const email = (who: string) => `${who}-${run}@loadtest.local`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cookieFrom(res: Response): string {
  const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

// NextAuth credentials sign-in over HTTP: csrf token + callback POST.
async function login(userEmail: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookie = cookieFrom(csrfRes);
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken, email: userEmail, password: PASSWORD, json: "true" }),
    redirect: "manual",
  });
  const session = cookieFrom(res);
  if (!/session-token/.test(session)) throw new Error(`login failed for ${userEmail} (${res.status})`);
  return `${csrfCookie}; ${session}`;
}

function countQueries(): number | null {
  if (!DEV_LOG) return null;
  const text = readFileSync(DEV_LOG, "utf8");
  return (text.match(/prisma:query/g) ?? []).length;
}

const pct = (arr: number[], p: number) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

async function main() {
  console.log(`Parent live view load test: ${PARENTS} parents, ${SECONDS}s, poll ${POLL_MS / 1000}s, ${WRITE_EVERY > 0 ? `coach writes every ${WRITE_EVERY}s` : "no coach writes (quiet spell)"}`);
  const hash = await bcrypt.hash(PASSWORD, 4);
  const coach = await prisma.user.create({
    data: { email: email("coach"), name: "Load Coach", passwordHash: hash, role: "COACH", plan: "COACH_PRO" },
  });
  const cleanup: string[] = [coach.id];
  try {
    const team = await prisma.team.create({
      data: { name: "Load Hawks 16U", ageGroup: "16U", coachId: coach.id, allowParentView: true },
    });
    const child = await prisma.player.create({
      data: { teamId: team.id, name: "Sofia", number: 7, primaryPosition: "OH" },
    });
    for (const [name, number] of [["Ava", 1], ["Noah", 2], ["Mia", 3], ["Eli", 4], ["Zoe", 5]] as const) {
      await prisma.player.create({ data: { teamId: team.id, name, number, primaryPosition: "UTIL" } });
    }
    const tournament = await prisma.tournament.create({
      data: { teamId: team.id, name: "Load Classic", startDate: new Date() },
    });
    const match = await prisma.match.create({
      data: { tournamentId: tournament.id, opponent: "Metro Tigers", matchNumber: 1 },
    });
    await prisma.statLine.create({
      data: { matchId: match.id, playerId: child.id, positionPlayed: "OH", kills: 3, digs: 4, sr2: 2 },
    });
    let us = 5;
    const history: [number, number][] = Array.from({ length: 9 }, (_, i) => [Math.min(us, Math.ceil(i * 5 / 8)), Math.min(3, Math.floor(i * 3 / 8))]);
    await prisma.matchSetScore.create({ data: { matchId: match.id, setNumber: 1, us, them: 3, history } });

    // Parents: one account each (the rate limit is per account) linked to the child.
    await prisma.user.createMany({
      data: Array.from({ length: PARENTS }, (_, i) => ({
        email: email(`parent${i}`), name: `Parent ${i}`, passwordHash: hash, role: "PARENT" as const,
      })),
    });
    const parents = await prisma.user.findMany({ where: { email: { endsWith: `-${run}@loadtest.local` }, role: "PARENT" }, select: { id: true, email: true } });
    cleanup.push(...parents.map((p) => p.id));
    await prisma.parentPlayerLink.createMany({ data: parents.map((p) => ({ parentId: p.id, playerId: child.id })) });
    console.log(`seeded team + ${parents.length} parents`);

    // Sign everyone in (batches, so the dev server isn't swamped).
    const coachCookie = await login(coach.email);
    const cookies: string[] = [];
    for (let i = 0; i < parents.length; i += 25) {
      cookies.push(...(await Promise.all(parents.slice(i, i + 25).map((p) => login(p.email)))));
    }
    console.log(`signed in ${cookies.length} parents`);

    const pollUrl = `${BASE}/api/parent/live?team=${team.id}&player=${child.id}`;
    // Warm-up (dev server compiles the route on first hit) - not counted.
    const warm = await fetch(pollUrl, { headers: { Cookie: cookies[0] } });
    if (warm.status !== 200) throw new Error(`warm-up poll returned ${warm.status}: ${await warm.text()}`);

    // What one coach write costs in queries, so the window's total can be
    // split between the writer and the parents.
    const writeOnce = async () => {
      us += 1;
      history.push([us, 3]);
      const res = await fetch(`${BASE}/api/matches/${match.id}/score`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: coachCookie },
        body: JSON.stringify({ setNumber: 1, us, them: 3, history }),
      });
      if (!res.ok) throw new Error(`score write failed: ${res.status}`);
    };
    const qBeforeWrite = countQueries();
    await writeOnce();
    await sleep(500);
    const writeCost = qBeforeWrite === null ? null : (countQueries() ?? 0) - qBeforeWrite;

    // ---- the window ----
    const stats = { byStatus: new Map<number, number>(), latencies: [] as number[], bytes: 0, errors: 0 };
    const start = Date.now();
    const end = start + SECONDS * 1000;
    const qStart = countQueries();
    let writes = 0;

    const poller = async (cookie: string, offsetMs: number) => {
      await sleep(offsetMs);
      let etag: string | null = null;
      while (Date.now() < end) {
        const t = Date.now();
        try {
          const res = await fetch(pollUrl, { headers: { Cookie: cookie, ...(etag ? { "If-None-Match": etag } : {}) } });
          stats.latencies.push(Date.now() - t);
          stats.byStatus.set(res.status, (stats.byStatus.get(res.status) ?? 0) + 1);
          if (res.status === 200) {
            etag = res.headers.get("etag");
            const body = await res.text();
            stats.bytes += body.length;
          } else {
            await res.arrayBuffer();
          }
        } catch {
          stats.errors += 1;
        }
        const wait = POLL_MS - (Date.now() - t);
        if (Date.now() + Math.max(0, wait) >= end) break;
        await sleep(Math.max(0, wait));
      }
    };
    const writer = async () => {
      if (WRITE_EVERY <= 0) return;
      await sleep(WRITE_MS);
      while (Date.now() + 1000 < end) {
        await writeOnce();
        writes += 1;
        await sleep(WRITE_MS);
      }
    };
    await Promise.all([
      ...cookies.map((c, i) => poller(c, Math.round((i / cookies.length) * POLL_MS))),
      writer(),
    ]);
    await sleep(1000);
    const qEnd = countQueries();

    // ---- report ----
    const total = [...stats.byStatus.values()].reduce((a, b) => a + b, 0);
    const notModified = stats.byStatus.get(304) ?? 0;
    const minutes = SECONDS / 60;
    console.log("\n=== Results ===");
    console.log(`requests: ${total} in ${SECONDS}s (${(total / minutes).toFixed(0)}/min) · errors ${stats.errors}`);
    for (const [code, n] of [...stats.byStatus.entries()].sort()) console.log(`  ${code}: ${n}${code === 304 ? ` (${((n / total) * 100).toFixed(1)}% not modified)` : ""}`);
    console.log(`latency ms: avg ${(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(1)} · p50 ${pct(stats.latencies, 50)} · p95 ${pct(stats.latencies, 95)} · max ${Math.max(...stats.latencies)}`);
    console.log(`payload bytes sent: ${stats.bytes} (${(stats.bytes / 1024).toFixed(1)} KB across ${stats.byStatus.get(200) ?? 0} full responses)`);
    console.log(`coach writes during window: ${writes}`);
    if (qStart !== null && qEnd !== null) {
      const windowQueries = qEnd - qStart;
      const writerQueries = writes * (writeCost ?? 0);
      const pollQueries = windowQueries - writerQueries;
      console.log(`database queries during window: ${windowQueries} total = ${pollQueries} for parent polls + ${writerQueries} for the coach's ${writes} writes (${writeCost} each)`);
      console.log(`  parent-poll queries per minute: ${(pollQueries / minutes).toFixed(1)} across ${PARENTS} parents (${(pollQueries / REFILL_QUERIES).toFixed(1)} full refills' worth; ${SECONDS / 10} windows of 10s, plus one match refill per coach write)`);
      console.log(`  same traffic on the old endpoint: ${PARENTS * 4} polls/min x ~${OLD_QUERIES_PER_POLL} queries = ~${PARENTS * 4 * OLD_QUERIES_PER_POLL} queries/min`);
    } else {
      console.log("database queries: set DEV_LOG=<dev server log> to count prisma:query lines");
    }
    console.log(`goal check: ${total} polls served with ${notModified} empty 304s; DB reads shared across all ${PARENTS} parents`);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: cleanup } } });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
