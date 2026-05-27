import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { isStripeConfigured } from "@/lib/stripe";
import {
  PLAN_LABEL,
  PLAN_LIMITS,
  PLAN_PRICING,
  isUnlimited,
  fmtCAD,
} from "@/lib/plan-limits";
import { BillingClient } from "./BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: { success?: string; canceled?: string };
}) {
  const user = await requireUser();

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

      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight">Billing & plan</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your subscription, see your usage, and pick the plan that
          matches the season ahead.
        </p>
      </header>

      {searchParams?.success === "true" && (
        <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
          🎉 Subscription activated. Welcome to Coach Pro / Club!
        </div>
      )}
      {searchParams?.canceled === "true" && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400">
          Checkout canceled. No charges were made.
        </div>
      )}

      {/* Current plan card */}
      <section className="mt-6 card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Current plan
            </div>
            <div className="mt-1 text-2xl font-bold">
              {PLAN_LABEL[user.plan]}
            </div>
            {fullUser?.planExpiresAt && (
              <div className="mt-1 text-xs text-amber-300">
                Scheduled to end {fullUser.planExpiresAt.toLocaleDateString()}
              </div>
            )}
          </div>
          <BillingClient
            plan={user.plan}
            hasStripeCustomer={Boolean(fullUser?.stripeId)}
            stripeConfigured={stripeConfigured}
          />
        </div>
      </section>

      {/* Usage */}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <UsageTile
          label="Teams"
          used={teamCount}
          limit={limits.maxTeams}
        />
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
      </section>

      {/* Plan comparison */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Compare plans</h2>
        <div className="grid gap-3 lg:grid-cols-3">
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
  const pct = isUnlimited(limit) ? 0 : Math.min(100, (used / limit) * 100);
  const near = !isUnlimited(limit) && used / limit >= 0.8;
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="stat-number text-2xl font-bold text-slate-100">
          {used}
        </span>
        <span className="text-sm text-slate-500">
          / {isUnlimited(limit) ? "unlimited" : limit}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      {!isUnlimited(limit) && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={"h-full " + (near ? "bg-amber-400" : "bg-cyan-400")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
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
      className={
        "card relative p-5 " +
        (isCurrent
          ? "border-cyan-400 ring-1 ring-cyan-400"
          : recommended
            ? "border-violet-400/40"
            : "")
      }
    >
      {recommended && !isCurrent && (
        <span className="absolute -top-2 right-4 rounded-md bg-violet-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-950">
          Most popular
        </span>
      )}
      {isCurrent && (
        <span className="absolute -top-2 right-4 rounded-md bg-cyan-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-950">
          Current
        </span>
      )}
      <h3 className="text-xl font-bold">{PLAN_LABEL[plan]}</h3>
      {pricing ? (
        <div className="mt-1 text-sm text-slate-400">
          {fmtCAD(pricing.monthlyCents)}/mo · {fmtCAD(pricing.yearlyCents)}/yr
        </div>
      ) : (
        <div className="mt-1 text-sm text-slate-400">Free forever</div>
      )}

      <ul className="mt-4 space-y-2 text-sm text-slate-200">
        <Item ok>
          {isUnlimited(limits.maxTeams) ? "Unlimited teams" : `${limits.maxTeams} team`}
        </Item>
        <Item ok>
          {isUnlimited(limits.maxTournamentsPerTeam)
            ? "Unlimited tournaments"
            : `${limits.maxTournamentsPerTeam} tournaments per team`}
        </Item>
        <Item ok>Courtside stat entry & Bank Account</Item>
        <Item ok>
          {isUnlimited(limits.maxReportCardsPerTournament)
            ? "Unlimited report cards"
            : `${limits.maxReportCardsPerTournament} report card / tournament`}
        </Item>
        <Item ok={limits.features.aiInsights}>AI coaching insights</Item>
        <Item ok={limits.features.shareLinks}>Parent share links</Item>
        <Item ok={limits.features.pdfExport}>PDF export</Item>
        <Item ok={limits.features.csvImport}>CSV / Excel import</Item>
        <Item ok={limits.features.seasonReports}>Season overview reports</Item>
        {plan === "CLUB" && <Item ok>Up to 15 coaches per club</Item>}
      </ul>
    </div>
  );
}

function Item({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      className={
        "flex items-start gap-2 " + (ok ? "text-slate-200" : "text-slate-600")
      }
    >
      <span
        className={
          "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold " +
          (ok
            ? "bg-emerald-400/15 text-emerald-300"
            : "bg-slate-800 text-slate-600")
        }
      >
        {ok ? "✓" : "-"}
      </span>
      <span>{children}</span>
    </li>
  );
}
