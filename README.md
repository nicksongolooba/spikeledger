# SpikeLedger

**Position-fair volleyball analytics for coaches.** Stats become insights via the Bank Account system: every action is a deposit or withdrawal, calibrated to what each position is *supposed* to do. A libero's good pass counts as a deposit. A hitter's is baseline. The result is fair comparison and clear, actionable improvement areas.

Phase 1–6 are complete. The app is deployable.

```
Auth · Teams · Players · Tournaments · Matches      [Phase 1]
Courtside stat entry (offline-capable)              [Phase 2]
Bank Account engine + Recharts dashboards            [Phase 3]
6-image WhatsApp report cards + share links          [Phase 4]
AI coaching insights (Claude or rule-based)          [Phase 5]
Stripe subscriptions + landing + launch polish       [Phase 6]
```

---

## Quick start (managed: Vercel + Neon)

1. **Database** — create a Neon project, copy the connection string.
2. **Stripe** — create the products described in [Stripe setup](#stripe-setup) below, grab the price IDs and the secret key. (Optional — the app runs without it; billing routes return 503.)
3. **Deploy** — push this repo to GitHub, import into Vercel, set the env vars below, deploy.
4. **Migrate** — Vercel will run `prisma generate` during build; run `npx prisma migrate deploy` once against your Neon database (locally is fine: `DATABASE_URL=... npx prisma migrate deploy`).
5. **Seed (optional)** — `DATABASE_URL=... npm run db:seed` to populate the Thunder Hawks demo team.

## Quick start (self-host: Docker Compose)

```bash
cp .env.example .env
# edit .env: set NEXTAUTH_SECRET (openssl rand -base64 32) and STRIPE_* if billing
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec app npm run db:seed   # optional
```

App at <http://localhost:3000>. Demo login: `demo@spikeledger.app` / `demo1234`.

To enable AI, set `ANTHROPIC_API_KEY` (see Environment variables below).

## Quick start (dev)

```bash
cp .env.example .env                      # fill DATABASE_URL + NEXTAUTH_SECRET
npm install
npx prisma migrate dev                    # against a local postgres
npm run db:seed                           # demo team
npm run dev                               # http://localhost:3000
```

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `NEXTAUTH_SECRET` | yes | NextAuth JWT signing key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | yes (prod) | Public app URL for OAuth callbacks |
| `NEXT_PUBLIC_APP_URL` | yes (prod) | Same URL, exposed to client for Stripe redirects |
| `ANTHROPIC_API_KEY` | no | Enables Claude for insights + coach chat (`sk-ant-...`) |
| `CLAUDE_MODEL` | no | Default `claude-sonnet-4-6` |
| `STRIPE_SECRET_KEY` | for billing | `sk_test_...` / `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | for billing | `pk_test_...` / `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | for billing | `whsec_...` from Stripe Dashboard → webhooks |
| `STRIPE_COACH_PRO_MONTHLY_PRICE_ID` | for billing | `price_...` |
| `STRIPE_COACH_PRO_YEARLY_PRICE_ID` | for billing | `price_...` |
| `STRIPE_CLUB_MONTHLY_PRICE_ID` | for billing | `price_...` |
| `STRIPE_CLUB_YEARLY_PRICE_ID` | for billing | `price_...` |
| `CRON_SECRET` | for dunning | Guards `/api/cron/dunning`. Vercel Cron sends it as a bearer token. |

If `STRIPE_SECRET_KEY` is missing, billing routes return `503` and the UI hides the upgrade buttons gracefully.

If `ANTHROPIC_API_KEY` is not set, AI insight calls silently fall back to the rule-based engine (coaches see a "Standard" badge instead of "AI"), and the coach chat returns a graceful "unavailable" message.

---

## Stripe setup

1. Create an account at [stripe.com](https://stripe.com).
2. **Products → Add product:**
   - "SpikeLedger Coach Pro" — recurring USD prices at **$9.99/month** and **$99.99/year**
   - "SpikeLedger Club" — recurring USD prices at **$49.99/month** and **$499.99/year**
3. Copy the four `price_...` IDs into your `.env`.
4. **Developers → Webhooks → Add endpoint:**
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
5. Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

For local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the printed `whsec_...`.

---

## Architecture

| Concern | Location |
| --- | --- |
| Routing / pages | `src/app/` (Next.js App Router) |
| Auth | NextAuth credentials provider, bcrypt, JWT sessions |
| Database | Prisma + Postgres |
| Bank Account engine | `src/engine/bank-account.ts` (pure) |
| Derived stats | `src/engine/derived-stats.ts` |
| Stat entry | `src/app/(app)/match/[id]/entry/` + localStorage WAL |
| Reports + sharing | `src/components/reports/` |
| AI insights | `src/engine/ai/` (Anthropic Claude / rule-based fallback) |
| Plan limits | `src/lib/plan-limits.ts` |
| Stripe | `src/app/api/stripe/` + `src/lib/stripe.ts` |

## NPM scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Run dev migrations |
| `npm run db:push` | Push schema without a migration (dev only) |
| `npm run db:seed` | Reset + reseed demo data |
| `npm run db:studio` | Open Prisma Studio |

## Verification scripts

```bash
node --import tsx scripts/verify-bank-account.mjs    # 32 unit tests of the Bank Account engine
node --import tsx scripts/verify-win-probability.mjs  # 39 unit tests of the live set win probability engine
node --import tsx scripts/verify-parent-flow.mts      # 122 DB-backed checks: parent codes, limits, live view + cache, the live scoreboard, the four player states and their wording (creates + deletes test rows)
DEV_LOG=/tmp/dev.log node --import tsx scripts/load-test-parent-live.mts --parents 200 --seconds 120   # parent live view load test against a running dev server
node --import tsx scripts/verify-match-notifications.mts   # 61 checks: match-start alerts (push or email, never both), real web push + Resend against local mocks
node scripts/verify-entry.mjs                        # browser smoke test (requires Playwright + chromium deps)
node --import tsx scripts/verify-safeguards.mts       # 54 checks (62 with BASE set): share-link privacy, rating language, gender-neutral generated copy, and the courtside grace tournament
node --import tsx scripts/verify-billing.mts          # 60 checks: plan reconciliation without a webhook, past_due grace, dunning emails, and deferred downgrades
BASE=http://127.0.0.1:3212 node --import tsx scripts/verify-install-detection.mts   # 18 browser checks: the install prompt never shows to someone who already installed the app (needs a running server)
node scripts/verify-app-icons.mjs                    # 48 checks: measures the generated platform icons pixel by pixel
node --import tsx scripts/verify-club-gating.mts      # 58 DB-backed checks: Club-plan gating and what happens when a club owner downgrades
```

## Brand and platform icons

```bash
node scripts/generate-pwa-assets.mjs   # rebuild every icon, splash screen and wordmark from the sources
node scripts/verify-app-icons.mjs      # measure what was written (sizes, opacity, circle size, centring)
node scripts/preview-app-icons.mjs     # render a sheet showing them on iPhone, taskbar, Android and tabs
```

Icon files are versioned in their filename (`-v4`). Phones and browsers cache an
app icon by URL, so new art always gets a new path.

## Billing that does not strand a coach

**A paid plan is never left to the webhook alone.** Three independent paths set
it, and all three funnel into one idempotent write in `src/lib/billing-sync.ts`:
the Checkout redirect confirms the session straight from Stripe, the billing
page reconciles on load (cached 60 seconds per coach), and the webhook is
idempotent on the Stripe event id. There is a "Refresh my plan" button as the
manual escape hatch. After a checkout redirect the page polls for up to 30
seconds showing "Payment received. Activating your plan.", and it never offers
an upgrade to somebody who has just paid.

**A failed card is not a cancellation.** Stripe's own dunning is the grace
period: `active`, `trialing` and `past_due` all keep full access, and only
`canceled`, `unpaid` or `incomplete_expired` drop a plan to Free. The owner is
emailed immediately, then after three days and six days, with a link that mints
a fresh Stripe portal session on the way through, and sees a banner with the
date access ends. Invited coaches see none of it, because they cannot fix
someone else's card.

**A downgrade never lands mid-match.** Before dropping a plan, the app checks
whether any team the coach owns, or any team in a club they own, has a match in
progress. If one does the downgrade is recorded and applied when the match is
finalised. An upgrade during a match applies immediately: it takes nothing
away.

**The reminders run on a schedule.** `vercel.json` has a cron entry that calls
`/api/cron/dunning` once a day at 14:00 UTC. Vercel sends
`Authorization: Bearer $CRON_SECRET` automatically once that variable is set in
the project, and the route rejects anything else with a plain 404. It fails
closed: with no `CRON_SECRET` configured it returns 503 and sends nothing.

To set it up: generate a secret with `openssl rand -base64 32`, add it as
`CRON_SECRET` in Vercel under Settings, Environment Variables, for Production,
then redeploy so the cron picks it up. Cron entries only register on a
production deployment. You can test it by hand with:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/dunning
```

On the Hobby plan Vercel allows one run per day per cron and fires it within
about an hour of the stated time, which is fine for a reminder that is
scheduled in days.

## Safeguards

Three rules that exist because of who uses this app.

**Public share links are temporary.** A `/share/[id]` page needs no login and
carries a child's performance data, so it expires 30 days after it is made, the
coach can revoke any of them from the team page, and an expired link shows a
neutral notice rather than the report. Every response carries `noindex,
nofollow`, `/share/` is disallowed in robots.txt, and no share URL is ever put
in the sitemap. Public pages show a first name and a jersey number, never a
full name, and the name is derived at render time so older reports are shown
safely too. The link preview image follows the same lifetime as the page.

**Ratings describe, they do not judge.** The Bank Account maths is unchanged;
only the labels are: Strong contribution, Solid, Building, Focus area, and Not
enough data yet. On anything a player or a parent reads, a negative balance is
never the headline. The deposits and the withdrawals lead instead, and the
focus areas say what to do next. `scripts/verify-safeguards.mts` fails if an
old label, or a word like "hurting", reappears anywhere in `src`.

**A coach courtside is never blocked.** No route the courtside screen calls
carries a plan check, and there is a test that fails if one is ever added. The
free tier tells a coach when they make their last free tournament, gives one
courtesy tournament past the limit with a banner saying so, and only then
enforces the limit, at tournament creation, never mid-match. If a match is
being scored, the limit gives way regardless. See `src/lib/courtside-grace.ts`.

## Club plan: active and dormant clubs

Club tools are **CLUB tier only**. The `/club` pages, the Club item in the
sidebar and every club API route go through one gate, `getClubAccess` in
`src/lib/club.ts`. Belonging to a club is not by itself enough.

A club is **active** while at least one OWNER still holds the CLUB plan. The
moment that stops being true the club is **dormant**.

**A dormant club grants nothing:** no club page, no sidebar item, no new
invites, no club settings, and no owner oversight of other coaches' teams.
Pending invite links stop working and say why. Members fall back to whatever
plan they pay for themselves, so a Coach Pro member becomes Coach Pro again
and a Free member becomes Free.

**Dormant is not deleted.** The club row, every membership, every invite and
the `clubId` on every team stay exactly as they were. Subscribing to Club
again makes the club active with nothing to rebuild: the same coaches, the
same teams, and even a still-unexpired invite link starts working again.

**Coaches keep their own work, in full.** Teams, players, matches, stats and
reports belong to the coach who created them and are never touched by a club
changing state. What a coach loses is only what the club was lending: the
CLUB feature tier and the club surfaces. The owner loses oversight of other
coaches' teams for the same reason.

A coach's own plan is never lowered by a club. The effective plan is the
better of what they pay for and what their club lends them.

## License

Proprietary — all rights reserved. Contact for licensing.

