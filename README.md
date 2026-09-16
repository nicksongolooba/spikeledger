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
node --import tsx scripts/verify-parent-flow.mts      # 84 DB-backed checks: parent codes, limits, live view + its cache (creates + deletes test rows)
DEV_LOG=/tmp/dev.log node --import tsx scripts/load-test-parent-live.mts --parents 200 --seconds 120   # parent live view load test against a running dev server
node --import tsx scripts/verify-match-notifications.mts   # 61 checks: match-start alerts (push or email, never both), real web push + Resend against local mocks
node scripts/verify-entry.mjs                        # browser smoke test (requires Playwright + chromium deps)
node scripts/verify-app-icons.mjs                    # 48 checks: measures the generated platform icons pixel by pixel
```

## Brand and platform icons

```bash
node scripts/generate-pwa-assets.mjs   # rebuild every icon, splash screen and wordmark from the sources
node scripts/verify-app-icons.mjs      # measure what was written (sizes, opacity, circle size, centring)
node scripts/preview-app-icons.mjs     # render a sheet showing them on iPhone, taskbar, Android and tabs
```

Icon files are versioned in their filename (`-v4`). Phones and browsers cache an
app icon by URL, so new art always gets a new path.

## License

Proprietary — all rights reserved. Contact for licensing.
