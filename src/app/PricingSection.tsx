"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { PLAN_PRICING, fmtCAD } from "@/lib/plan-limits";
import { cn } from "@/lib/utils";

interface Tier {
  name: string;
  blurb: string;
  monthlyCents: number;
  yearlyCents: number;
  features: { label: string; ok: boolean }[];
  ctaLabel: string;
  ctaHref: string;
  recommended?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    blurb: "One team, the whole Bank Account. Free for good.",
    monthlyCents: 0,
    yearlyCents: 0,
    features: [
      { label: "1 team", ok: true },
      { label: "3 tournaments per team", ok: true },
      { label: "Courtside stat entry", ok: true },
      { label: "Bank Account analysis", ok: true },
      { label: "1 report card per tournament", ok: true },
      { label: "Ask Coach AI", ok: false },
      { label: "Parent share links", ok: false },
      { label: "PDF and bulk report cards", ok: false },
      { label: "CSV / Excel import", ok: false },
    ],
    ctaLabel: "Start free",
    ctaHref: "/register",
  },
  {
    name: "Coach Pro",
    blurb: "Every team you coach, no limits, every report card.",
    monthlyCents: PLAN_PRICING.COACH_PRO.monthlyCents,
    yearlyCents: PLAN_PRICING.COACH_PRO.yearlyCents,
    features: [
      { label: "Unlimited teams", ok: true },
      { label: "Unlimited tournaments", ok: true },
      { label: "Courtside stat entry", ok: true },
      { label: "Bank Account analysis", ok: true },
      { label: "Unlimited report cards", ok: true },
      { label: "Ask Coach AI", ok: true },
      { label: "Parent share links", ok: true },
      { label: "PDF, ZIP and share sheet", ok: true },
      { label: "CSV / Excel import", ok: true },
    ],
    ctaLabel: "Start Coach Pro",
    ctaHref: "/register?plan=COACH_PRO",
    recommended: true,
  },
  {
    name: "Club",
    blurb: "One subscription, every coach in the club on the same data.",
    monthlyCents: PLAN_PRICING.CLUB.monthlyCents,
    yearlyCents: PLAN_PRICING.CLUB.yearlyCents,
    features: [
      { label: "Everything in Coach Pro", ok: true },
      { label: "Up to 15 coaches", ok: true },
      { label: "Invite links, no seat juggling", ok: true },
      { label: "Club owner sees every team", ok: true },
      { label: "Priority support", ok: true },
    ],
    ctaLabel: "Start Club",
    ctaHref: "/register?plan=CLUB",
  },
];

export function PricingSection() {
  const [interval, setInterval] = useState<"month" | "year">("month");

  function priceLabel(cents: number) {
    if (cents === 0) return "Free";
    return fmtCAD(cents);
  }

  return (
    <div>
      <div
        role="group"
        aria-label="Billing interval"
        className="mx-auto mb-10 flex w-fit rounded-md border border-slate-300 bg-white p-1 text-sm"
      >
        {(["month", "year"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setInterval(opt)}
            aria-pressed={interval === opt}
            className={cn(
              "rounded px-4 py-1.5 font-semibold transition-colors",
              interval === opt
                ? "bg-navy-900 text-white"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {opt === "month" ? "Monthly" : "Yearly · 2 months free"}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {TIERS.map((t) => {
          const cents = interval === "month" ? t.monthlyCents : t.yearlyCents;
          const suffix =
            t.monthlyCents === 0 ? "" : interval === "month" ? "/month" : "/year";
          return (
            <div
              key={t.name}
              className={cn(
                "card relative flex flex-col overflow-hidden",
                t.recommended && "border-navy-900 shadow-lift lg:-mt-4",
              )}
            >
              {t.recommended && (
                <div className="bg-navy-900 px-6 py-2 text-center font-display text-xs font-bold uppercase tracking-[0.16em] text-cyan-500">
                  Most coaches pick this
                </div>
              )}
              <div className="p-6">
                <h3 className="font-display text-2xl font-bold text-slate-900">
                  {t.name}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{t.blurb}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="stat-number text-5xl font-bold leading-none text-slate-900">
                    {priceLabel(cents)}
                  </span>
                  <span className="text-sm text-slate-500">{suffix}</span>
                </div>
                {cents > 0 && (
                  <div className="mt-1 text-xs text-slate-500">
                    CAD, cancel any time
                  </div>
                )}

                <ul className="mt-6 space-y-2.5 text-sm">
                  {t.features.map((f) => (
                    <li
                      key={f.label}
                      className={cn(
                        "flex items-start gap-2.5",
                        f.ok ? "text-slate-800" : "text-slate-400",
                      )}
                    >
                      {f.ok ? (
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
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={t.ctaHref}
                  className={cn(
                    "mt-7 flex w-full py-2.5",
                    t.recommended ? "btn-primary" : "btn-navy",
                  )}
                >
                  {t.ctaLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
