// Parent accounts can't create a team, start a Stripe checkout or join a
// club. Each is refused at the server with a 403 and a reason, while a coach
// doing the same thing still gets through.
//
// Creates its own users, club and invites (all @rolegates-test.local) and
// deletes them at the end. Needs a running server:
//   npm run build && npx next start -p 3219
//   BASE=http://127.0.0.1:3219 node --env-file=.env --import tsx scripts/verify-parent-role-gates.mts

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { acceptInvite, ClubError, createInvite, ensureClubForOwner } from "@/lib/club";

const BASE = process.env.BASE ?? "http://127.0.0.1:3219";
const run = Date.now().toString(36);
const email = (who: string) => `${who}-${run}@rolegates-test.local`;
const PASSWORD = "rolegates-test";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); }
  else { failed += 1; console.error(`  ✗ ${name}${detail ? `  (${detail})` : ""}`); }
}

// A signed-in session, through NextAuth's own credentials endpoint.
async function signIn(address: string) {
  const jar = new Map<string, string>();
  const send = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(BASE + path, {
      redirect: "manual",
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
    return res;
  };
  const { csrfToken } = await (await send("/api/auth/csrf")).json();
  await send("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email: address, password: PASSWORD, json: "true" }),
  });
  if (![...jar.keys()].some((k) => k.includes("session-token"))) throw new Error(`could not sign in ${address}`);
  const post = async (path: string, body: unknown) => {
    const res = await send(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as { error?: string } };
  };
  return { post };
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const make = (who: string, role: "COACH" | "PARENT", plan: "FREE" | "CLUB" = "FREE") =>
    prisma.user.create({ data: { email: email(who), name: who, passwordHash, role, plan } });
  const owner = await make("owner", "COACH", "CLUB");
  const coach = await make("coach", "COACH");
  const parent = await make("parent", "PARENT");
  let clubId: string | null = null;
  try {
    clubId = (await ensureClubForOwner(owner.id))?.club.id ?? null;
    const asCoach = await signIn(coach.email);
    const asParent = await signIn(parent.email);

    console.log("\nCreate a team");
    const pTeam = await asParent.post("/api/teams", { name: "Parent's team" });
    check("a parent is refused with 403", pTeam.status === 403, String(pTeam.status));
    check("and told why", (pTeam.body.error ?? "").includes("Parent accounts can't create teams"), pTeam.body.error);
    check("and no team was created", (await prisma.team.count({ where: { coachId: parent.id } })) === 0);
    const cTeam = await asCoach.post("/api/teams", { name: "Coach's team" });
    check("a coach still creates a team", cTeam.status < 300, String(cTeam.status));
    check("and it exists", (await prisma.team.count({ where: { coachId: coach.id } })) === 1);

    console.log("\nStart a Stripe checkout");
    const pPay = await asParent.post("/api/stripe/create-checkout", { plan: "COACH_PRO", interval: "month" });
    check("a parent is refused with 403", pPay.status === 403, String(pPay.status));
    check("and told why", (pPay.body.error ?? "").includes("Parent accounts don't need a plan"), pPay.body.error);
    check("and no Stripe customer was made for them", (await prisma.user.findUnique({ where: { id: parent.id } }))?.stripeId == null);
    // With no Stripe keys on this server a coach gets 503, which shows the
    // request got past the role check to the billing code.
    const cPay = await asCoach.post("/api/stripe/create-checkout", { plan: "COACH_PRO", interval: "month" });
    check("a coach gets past the role check", cPay.status !== 403, `${cPay.status} ${cPay.body.error ?? ""}`);

    console.log("\nJoin a club by invite");
    check("the owner's club is active", clubId !== null);
    const forParent = await createInvite(owner.id, parent.email);
    const pJoin = await asParent.post("/api/club/invites/accept", { code: forParent.code });
    check("a parent is refused with 403", pJoin.status === 403, String(pJoin.status));
    check("and told why", (pJoin.body.error ?? "").includes("Parent accounts can't join a club"), pJoin.body.error);
    check("and did not join", (await prisma.clubMember.count({ where: { userId: parent.id } })) === 0);
    const invite = await prisma.clubInvite.findUnique({ where: { code: forParent.code } });
    check("and the invite is still unused", invite?.acceptedAt == null);
    // The same refusal holds for any caller of acceptInvite, not just the route.
    let libError: unknown = null;
    try { await acceptInvite(forParent.code, parent.id); } catch (e) { libError = e; }
    check("acceptInvite itself refuses a parent", libError instanceof ClubError && libError.status === 403);
    const forCoach = await createInvite(owner.id, coach.email);
    const cJoin = await asCoach.post("/api/club/invites/accept", { code: forCoach.code });
    check("a coach still joins", cJoin.status === 200, `${cJoin.status} ${cJoin.body.error ?? ""}`);
    check("and is a member", (await prisma.clubMember.count({ where: { userId: coach.id, clubId: clubId ?? "" } })) === 1);
  } finally {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@rolegates-test.local" } } });
    if (clubId) await prisma.club.deleteMany({ where: { id: clubId } });
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.user.deleteMany({ where: { email: { endsWith: "@rolegates-test.local" } } }).catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
