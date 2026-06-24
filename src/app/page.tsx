import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PricingSection } from "./PricingSection";

export const metadata: Metadata = {
  title: "SpikeLedger - Position-Fair Volleyball Analytics",
  description:
    "Turn match stats into coaching feedback you can use, with the Bank Account system. WhatsApp-ready report cards, AI coaching, and position-fair analysis for volleyball coaches.",
  keywords: [
    "volleyball stats",
    "volleyball analytics",
    "volleyball coaching app",
    "volleyball report card",
    "volleyball stat tracker",
    "bank account volleyball",
  ],
  openGraph: {
    title: "SpikeLedger - Position-Fair Volleyball Analytics",
    description:
      "The coaching analytics tool that evaluates every player fairly by position.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SpikeLedger",
    description: "Position-fair volleyball analytics for coaches",
  },
};

const features = [
  {
    title: "Bank Account System",
    body: "Every action is a deposit or withdrawal, calibrated to what each position is supposed to do. A libero's good pass counts. A hitter's is baseline.",
    accent: "from-volt-400/20 to-volt-400/5",
    iconColor: "text-volt-300",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </svg>
    ),
  },
  {
    title: "Courtside Stat Entry",
    body: "Two taps: the player, then what they did. Works one-handed on your phone in a loud gym. Works offline too, so bad WiFi never loses a stat.",
    accent: "from-emerald-400/20 to-emerald-400/5",
    iconColor: "text-emerald-300",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    ),
  },
  {
    title: "WhatsApp-Ready Reports",
    body: "Six-image player report cards sized for phone screens. Share to parents in one tap. Public share links work without an account.",
    accent: "from-violet-400/20 to-violet-400/5",
    iconColor: "text-violet-300",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <rect x="4" y="3" width="16" height="18" rx="2.5" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    title: "AI Coaching Insights",
    body: "Powered by advanced AI. Specific drill recommendations based on each player's actual numbers. Never generic, always position-aware.",
    accent: "from-amber-400/20 to-amber-400/5",
    iconColor: "text-amber-300",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
      </svg>
    ),
  },
  {
    title: "Position-Fair Comparison",
    body: "Liberos compared to liberos. Hitters to hitters. Never judge a defensive specialist by kills or a middle by serve receive.",
    accent: "from-volt-400/20 to-volt-400/5",
    iconColor: "text-volt-300",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M3 6h18M3 12h12M3 18h6" />
      </svg>
    ),
  },
  {
    title: "Works Globally",
    body: "Volleyball stats are universal. The Bank Account math doesn't care what country or league. Built by a coach, ready everywhere.",
    accent: "from-emerald-400/20 to-emerald-400/5",
    iconColor: "text-emerald-300",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18" />
      </svg>
    ),
  },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing portal - your plan stays active through the end of the period, then drops to Free. No questions asked.",
  },
  {
    q: "What happens to my data if I downgrade?",
    a: "Nothing. Every stat, match, and player you've logged stays. You just hit the Free-plan limits again (1 team, 3 tournaments) - and any data above those limits becomes read-only until you upgrade or remove it.",
  },
  {
    q: "Do you offer team or club discounts?",
    a: "The Club tier is built for it - one subscription covers up to 15 coaches sharing data. For larger orgs, email us and we'll work out a plan.",
  },
  {
    q: "Is my players' data private?",
    a: "Yes. Only you (and any coaches you explicitly invite on the Club plan) can see your team's stats. Public share links are opt-in per report and revocable from your dashboard.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. SpikeLedger runs in any modern browser, including mobile. The stat entry page is designed to work one-handed on a phone at courtside.",
  },
  {
    q: "Can I import stats from a spreadsheet?",
    a: "Yes - Coach Pro and up. Drag in a CSV or Excel file, map your columns, and a whole season backfills in a minute.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* Structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "SpikeLedger",
            applicationCategory: "SportsApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
            description:
              "Position-fair volleyball analytics. The Bank Account system, WhatsApp-ready report cards, and AI coaching insights for volleyball coaches.",
          }),
        }}
      />
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-volt-400/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[600px] rounded-full bg-violet-400/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-full.png"
              alt="SpikeLedger"
              width={556}
              height={141}
              priority
              className="h-9 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3">
            <Link href="#features" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-slate-100 sm:inline">
              Features
            </Link>
            <Link href="#pricing" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-slate-100 sm:inline">
              Pricing
            </Link>
            <Link href="/blog" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-slate-100">
              Blog
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-slate-100"
            >
              Login
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              Start Free
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-12 text-center sm:pt-20">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Built by a coach, for coaches
        </div>
        <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl md:text-6xl">
          Your Team&apos;s Performance Has a{" "}
          <span className="bg-gradient-to-r from-volt-300 via-volt-400 to-gold-300 bg-clip-text text-transparent">
            Balance Sheet
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-slate-400 sm:text-xl">
          SpikeLedger turns match stats into position-fair coaching insights.
          The Bank Account system every volleyball coach needs.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Start Free - No Credit Card Required
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">
            I already have an account
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          1 team, 3 tournaments, the full Bank Account system. Free forever.
        </p>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto mt-24 max-w-6xl px-6 sm:mt-32">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Everything coaches actually need
        </h2>
        <p className="mt-3 text-center text-slate-400">
          The features the original analytics pipeline made obvious. Now in your browser.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card relative overflow-hidden p-6">
              <div
                className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${f.accent} blur-2xl`}
              />
              <div
                className={`relative mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 ${f.iconColor}`}
              >
                {f.icon}
              </div>
              <h3 className="relative text-lg font-semibold text-slate-100">
                {f.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-slate-400">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 mx-auto mt-24 max-w-6xl px-6 sm:mt-32">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Simple pricing
        </h2>
        <p className="mt-3 text-center text-slate-400">
          Free tier is a real product - not a crippled demo. Upgrade when you
          want it for your whole team.
        </p>
        <div className="mt-12">
          <PricingSection />
        </div>
      </section>

      {/* Social proof placeholder */}
      <section className="relative z-10 mx-auto mt-24 max-w-6xl px-6 sm:mt-32">
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/30 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Built from a real season of coaching.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            The Bank Account system was calibrated across multiple seasons of
            competitive volleyball - not invented in a boardroom. Every metric was
            stress-tested against what actually helps youth players improve.
          </p>
          <div className="mt-8">
            <Link href="/register" className="btn-primary px-6 py-3 text-base">
              Start with your first team
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 mx-auto mt-24 max-w-3xl px-6 sm:mt-32">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently asked
        </h2>
        <div className="mt-10 space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700 open:border-slate-700"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium text-slate-100">
                {faq.q}
                <span className="text-slate-500 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mt-32 border-t border-slate-800/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center">
              <Image
                src="/logo-full.png"
                alt="SpikeLedger"
                width={556}
                height={141}
                className="h-7 w-auto"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Built by a volleyball coach, for volleyball coaches.
            </p>
          </div>
          <nav className="flex flex-wrap gap-4 text-xs text-slate-400">
            <Link href="#features" className="hover:text-slate-200">Features</Link>
            <Link href="#pricing" className="hover:text-slate-200">Pricing</Link>
            <Link href="/blog" className="hover:text-slate-200">Blog</Link>
            <Link href="/login" className="hover:text-slate-200">Login</Link>
            <Link href="/register" className="hover:text-slate-200">Register</Link>
            <Link href="/privacy" className="hover:text-slate-200">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-200">Terms of Service</Link>
            <Link href="/contact" className="hover:text-slate-200">Contact</Link>
          </nav>
        </div>
        <div className="mx-auto mt-6 max-w-6xl px-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} SpikeLedger ·{" "}
          <a href="mailto:support@spikeledger.com" className="hover:text-slate-400">
            support@spikeledger.com
          </a>
        </div>
      </footer>
    </div>
  );
}
