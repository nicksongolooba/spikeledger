import type { Plan } from "@prisma/client";
import { AlertTriangle, Check, Minus } from "lucide-react";
import { requireCoach } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { isStripeConfigured } from "@/lib/stripe";
import { reconcileUserPlan } from "@/lib/billing-sync";
import {
  PLAN_LABEL,
  PLAN_LIMITS,
  PLAN_PRICING,
  isUnlimited,
  fmtUSD,
} from "@/lib/plan-limits";
import { cn } from "@/lib/utils";
import { BillingClient } from "./BillingClient";

export const dynamic = "force-dynamic";

// One line under the plan name so a coach knows what the tier is for.
const PLAN_BLURB: Record<Plan, string> = {
  FREE: "One team, three tournaments, the whole Bank Account. Upgrade when the season outgrows it.",
  COACH_PRO:
    "Unlimited teams and tournaments, report cards for every player, share links, imports and AI insights.",
  CLUB: "Everything in Coach Pro for up to 15 coaches on one subscription.",
};

// Small label above each plan card.
const PLAN_EYEBROW: Record<Plan, string> = {
  FREE: "One team",
  COACH_PRO: "Most popular",
  CLUB: "Whole club",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: { success?: string; canceled?: string; session_id?: string };
}) {
  const user = await requireCoach();

  // The database is not trusted on its own here. Stripe is asked what it
  // thinks, at most once a minute per coach, and anything that disagrees is
  // corrected before the page renders. A coach who paid and never got a
  // working webhook is fixed by loading this page.
  await reconcileUserPlan(user.id).catch((err) =>
    console.error("[billing] reconcile on page load failed:", err),
  );

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      plan: true,
      stripeId: true,
      stripeSubscriptionId: true,
      planExpiresAt: true,
    },
  });

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  // Report has no FK relation back to Team, so resolve the coach's team IDs
  // first and filter by teamId IN (...).
  const teams = await prisma.team.findMany({
    where: { coachId: user.id },
    select: { id: true },
  });
  const teamIds = teams.map((t) => t.id);

  const [teamCount, tournamentCount, reportsThisMonth] = await Promise.all([
    Promise.resolve(teamIds.length),
    prisma.tournament.count({ where: { team: { coachId: user.id } } }),
    prisma.report.count({
      where: {
        teamId: { in: teamIds },
        generatedAt: { gte: monthStart },
      },
    }),
  ]);

  const limits = PLAN_LIMITS[user.plan];
  const stripeConfigured = isStripeConfigured();

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Billing" },
        ]}
      />

      <header className="mt-5">
        <div className="eyebrow">Settings</div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Billing and plan
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">
          Your plan, how much of it you have used, and what the next tier adds.
        </p>
      </header>

      {searchParams?.success === "true" && (
        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          <Check
            size={16}
            strokeWidth={2.5}
            className="mt-0.5 shrink-0 text-green-600"
            aria-hidden
          />
          <span>
            <span className="font-semibold">Subscription active.</span> Your new
            limits apply right away.
          </span>
        </div>
      )}
      {searchParams?.canceled === "true" && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Checkout canceled. Nothing was charged.
        </div>
      )}

      {/* Current plan + usage */}
      <section className="card mt-8 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div>
            <div className="eyebrow">Current plan</div>
            <h2 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl">
              {PLAN_LABEL[user.plan]}
            </h2>
            {fullUser?.planExpiresAt ? (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                <AlertTriangle size={14} strokeWidth={2} aria-hidden />
                Scheduled to end {fullUser.planExpiresAt.toLocaleDateString()}
              </div>
            ) : (
              <p className="mt-3 max-w-md text-sm text-slate-600">
                {PLAN_BLURB[user.plan]}
              </p>
            )}
          </div>
          <BillingClient
            plan={user.plan}
            hasStripeCustomer={Boolean(fullUser?.stripeId)}
            stripeConfigured={stripeConfigured}
          />
        </div>
        <dl className="grid divide-y divide-slate-200 border-t border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <UsageTile label="Teams" used={teamCount} limit={limits.maxTeams} />
          <UsageTile
            label="Tournaments"
            used={tournamentCount}
            limit={limits.maxTournamentsPerTeam}
            suffix="per team"
          />
          <UsageTile
            label="Shared reports this month"
            used={reportsThisMonth}
            limit={Number.POSITIVE_INFINITY}
          />
        </dl>
      </section>

      {/* Plan comparison */}
      <section className="mt-12">
        <div className="eyebrow text-slate-500">Plans</div>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
          Compare plans
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Every plan has courtside entry and the Bank Account. Paid plans lift
          the caps and add sharing, imports and AI insights.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <PlanColumn plan="FREE" currentPlan={user.plan} />
          <PlanColumn plan="COACH_PRO" currentPlan={user.plan} recommended />
          <PlanColumn plan="CLUB" currentPlan={user.plan} />
        </div>
      </section>
    </div>
  );
}

function UsageTile({
  label,
  used,
  limit,
  suffix,
}: {
  label: string;
  used: number;
  limit: number;
  suffix?: string;
}) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited ? 0 : Math.min(100, (used / limit) * 100);
  const near = !unlimited && used / limit >= 0.8;
  return (
    <div className="px-6 py-4">
      <dt className="eyebrow text-slate-500">{label}</dt>
      <dd className="mt-1">
        <div className="flex items-baseline gap-1.5">
          <span className="stat-number text-3xl font-bold leading-none text-slate-900">
            {used}
          </span>
          <span className="text-sm text-slate-500">
            / {unlimited ? "unlimited" : limit}
            {suffix ? ` ${suffix}` : ""}
          </span>
        </div>
        {!unlimited && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                "h-full rounded-full",
                near ? "bg-amber-500" : "bg-cyan-500",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </dd>
    </div>
  );
}

function PlanColumn({
  plan,
  currentPlan,
  recommended,
}: {
  plan: "FREE" | "COACH_PRO" | "CLUB";
  currentPlan: "FREE" | "COACH_PRO" | "CLUB";
  recommended?: boolean;
}) {
  const limits = PLAN_LIMITS[plan];
  const isCurrent = plan === currentPlan;
  const pricing = plan === "FREE" ? null : PLAN_PRICING[plan];

  return (
    <div
      className={cn(
        "card flex flex-col overflow-hidden",
        recommended ? "border-navy-900" : isCurrent && "border-navy-300",
      )}
    >
      <div
        className={cn(
          "px-5 py-4",
          recommended ? "bg-navy-900 text-white" : "border-b border-slate-200",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className={cn(
                "eyebrow",
                recommended ? "text-cyan-500" : "text-slate-500",
              )}
            >
              {PLAN_EYEBROW[plan]}
            </div>
            <h3
              className={cn(
                "mt-1 font-display text-2xl font-bold leading-none",
                !recommended && "text-slate-900",
              )}
            >
              {PLAN_LABEL[plan]}
            </h3>
          </div>
          {isCurrent && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold",
                recommended
                  ? "bg-white/15 text-white"
                  : "border border-navy-200 bg-navy-50 text-navy-800",
              )}
            >
              <Check size={12} strokeWidth={2.5} aria-hidden />
              Your plan
            </span>
          )}
        </div>
        <div className="mt-4 flex items-baseline gap-1.5">
          <span
            className={cn(
              "stat-number text-3xl font-bold leading-none",
              !recommended && "text-slate-900",
            )}
          >
            {pricing ? fmtUSD(pricing.monthlyCents) : "$0"}
          </span>
          <span
            className={cn(
              "text-sm",
              recommended ? "text-navy-200" : "text-slate-500",
            )}
          >
            {pricing ? "/ month" : "forever"}
          </span>
        </div>
        {pricing && (
          <div
            className={cn(
              "mt-1 text-xs",
              recommended ? "text-navy-300" : "text-slate-500",
            )}
          >
            or {fmtUSD(pricing.yearlyCents)} / year
          </div>
        )}
      </div>

      <ul className="flex-1 space-y-2.5 p-5 text-sm">
        <Item ok>
          {isUnlimited(limits.maxTeams) ? "Unlimited teams" : `${limits.maxTeams} team`}
        </Item>
        <Item ok>
          {isUnlimited(limits.maxTournamentsPerTeam)
            ? "Unlimited tournaments"
            : `${limits.maxTournamentsPerTeam} tournaments per team`}
        </Item>
        <Item ok>Courtside entry and the Bank Account</Item>
        <Item ok>
          {isUnlimited(limits.maxReportCardsPerTournament)
            ? "Report cards for every player"
            : `${limits.maxReportCardsPerTournament} report card per tournament`}
        </Item>
        <Item ok={limits.features.aiInsights}>AI coaching insights</Item>
        <Item ok={limits.features.shareLinks}>Parent share links</Item>
        <Item ok={limits.features.pdfExport}>PDF export</Item>
        <Item ok={limits.features.csvImport}>CSV and Excel import</Item>
        <Item ok={limits.features.seasonReports}>Season reports</Item>
        {plan === "CLUB" && <Item ok>Up to 15 coaches on one plan</Item>}
      </ul>
    </div>
  );
}

function Item({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      className={cn(
        "flex items-start gap-2.5",
        ok ? "text-slate-700" : "text-slate-400",
      )}
    >
      {ok ? (
        <Check
          size={16}
          strokeWidth={2.5}
          className="mt-0.5 shrink-0 text-green-600"
          aria-hidden
        />
      ) : (
        <Minus
          size={16}
          strokeWidth={2}
          className="mt-0.5 shrink-0 text-slate-300"
          aria-hidden
        />
      )}
      <span>{children}</span>
    </li>
  );
}
