"use client";

import Link from "next/link";
import { useState } from "react";
import { PLAN_PRICING, fmtCAD } from "@/lib/plan-limits";

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
    blurb: "The whole Bank Account system, free forever.",
    monthlyCents: 0,
    yearlyCents: 0,
    features: [
      { label: "1 team", ok: true },
      { label: "3 tournaments per team", ok: true },
      { label: "Stat entry & Bank Account analysis", ok: true },
      { label: "1 report card per tournament", ok: true },
      { label: "AI coaching insights", ok: false },
      { label: "Parent share links", ok: false },
      { label: "PDF + bulk report cards", ok: false },
      { label: "CSV / Excel import", ok: false },
    ],
    ctaLabel: "Start Free",
    ctaHref: "/register",
  },
  {
    name: "Coach Pro",
    blurb: "Everything, for your whole team.",
    monthlyCents: PLAN_PRICING.COACH_PRO.monthlyCents,
    yearlyCents: PLAN_PRICING.COACH_PRO.yearlyCents,
    features: [
      { label: "Unlimited teams", ok: true },
      { label: "Unlimited tournaments", ok: true },
      { label: "Stat entry & Bank Account analysis", ok: true },
      { label: "Unlimited report cards", ok: true },
      { label: "AI coaching insights (Gemma 4)", ok: true },
      { label: "Parent share links", ok: true },
      { label: "PDF + WhatsApp share", ok: true },
      { label: "CSV / Excel import", ok: true },
    ],
    ctaLabel: "Start Coach Pro",
    ctaHref: "/register?plan=COACH_PRO",
    recommended: true,
  },
  {
    name: "Club",
    blurb: "For clubs with multiple coaches.",
    monthlyCents: PLAN_PRICING.CLUB.monthlyCents,
    yearlyCents: PLAN_PRICING.CLUB.yearlyCents,
    features: [
      { label: "Everything in Coach Pro", ok: true },
      { label: "Up to 15 coaches per club", ok: true },
      { label: "Shared roster & data", ok: true },
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
    return fmtCAD(interval === "month" ? cents : cents);
  }

  return (
    <div>
      <div className="mx-auto mb-8 flex w-fit rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
        <button
          type="button"
          onClick={() => setInterval("month")}
          className={
            "rounded-md px-4 py-1.5 font-semibold transition-colors " +
            (interval === "month"
              ? "bg-cyan-400 text-cyan-950"
              : "text-slate-400 hover:text-slate-100")
          }
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("year")}
          className={
            "rounded-md px-4 py-1.5 font-semibold transition-colors " +
            (interval === "year"
              ? "bg-cyan-400 text-cyan-950"
              : "text-slate-400 hover:text-slate-100")
          }
        >
          Yearly · save 17%
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((t) => {
          const cents = interval === "month" ? t.monthlyCents : t.yearlyCents;
          const suffix = t.monthlyCents === 0
            ? ""
            : interval === "month"
              ? "/month"
              : "/year";
          return (
            <div
              key={t.name}
              className={
                "card relative p-6 " +
                (t.recommended ? "border-violet-400/40" : "")
              }
            >
              {t.recommended && (
                <span className="absolute -top-2 right-5 rounded-md bg-violet-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-950">
                  Most popular
                </span>
              )}
              <h3 className="text-xl font-bold">{t.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{t.blurb}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="stat-number text-4xl font-bold">
                  {priceLabel(cents)}
                </span>
                <span className="text-sm text-slate-500">{suffix}</span>
              </div>

              <ul className="mt-5 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li
                    key={f.label}
                    className={
                      "flex items-start gap-2 " +
                      (f.ok ? "text-slate-200" : "text-slate-600")
                    }
                  >
                    <span
                      className={
                        "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold " +
                        (f.ok
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-slate-800 text-slate-600")
                      }
                    >
                      {f.ok ? "✓" : "-"}
                    </span>
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={t.ctaHref}
                className={
                  "mt-6 flex w-full items-center justify-center " +
                  (t.recommended
                    ? "bg-violet-400 hover:bg-violet-300 text-violet-950 btn"
                    : "btn-primary")
                }
              >
                {t.ctaLabel}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
