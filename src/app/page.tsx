import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  ChevronDown,
  EllipsisVertical,
  FileImage,
  MessageSquareText,
  MonitorDown,
  RefreshCw,
  Scale,
  Share,
  Smartphone,
  Undo2,
  User,
  WifiOff,
} from "lucide-react";
import { PricingSection } from "./PricingSection";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { Wordmark } from "@/components/layout/Wordmark";
import { TESTIMONIALS } from "@/content/testimonials";
import { cn } from "@/lib/utils";
// Photography: web copies made by scripts/optimize-photos.mjs.
import heroCourt from "@/assets/photos/hero-court.jpg";
import coachCourtside from "@/assets/photos/coach-courtside.jpg";
import playerSpike from "@/assets/photos/player-spike.jpg";
import playerPass from "@/assets/photos/player-pass.jpg";
import teamHuddle from "@/assets/photos/team-huddle.jpg";
import phoneGym from "@/assets/photos/phone-gym.jpg";
import parentsBleachers from "@/assets/photos/parents-bleachers.jpg";
import shotDashboard from "@/assets/screens/dashboard.png";
import shotPlayer from "@/assets/screens/player.png";
import shotEntry from "@/assets/screens/entry.png";
import shotEntryActions from "@/assets/screens/entry-actions.png";
import cardOverview from "@/assets/screens/card-overview.png";
import cardBank from "@/assets/screens/card-bank.png";

export const metadata: Metadata = {
  title: "SpikeLedger - Volleyball stats that are fair to every position",
  description:
    "Courtside stat entry, the position-fair Bank Account, and six-image report cards parents actually understand. Built by a club volleyball coach. Free for one team.",
  keywords: [
    "volleyball stats",
    "volleyball analytics",
    "volleyball coaching app",
    "volleyball report card",
    "volleyball stat tracker",
    "bank account volleyball",
  ],
  openGraph: {
    title: "SpikeLedger - Volleyball stats that are fair to every position",
    description:
      "Courtside stat entry, the position-fair Bank Account, and report cards parents actually understand.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SpikeLedger",
    description: "Volleyball stats that are fair to every position.",
  },
};

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#courtside", label: "Courtside" },
  { href: "#reports", label: "Report cards" },
  { href: "#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

const STRIP = [
  { icon: Smartphone, title: "Two taps per rally", body: "The player, then what happened." },
  { icon: WifiOff, title: "Works offline", body: "Saves on the phone, syncs later." },
  { icon: Scale, title: "Position-fair", body: "Liberos graded as liberos." },
  { icon: FileImage, title: "Six-image report cards", body: "Sized for WhatsApp and iMessage." },
];

const STEPS = [
  {
    n: "01",
    title: "Courtside, during the match",
    body: "Tap the player, tap the action. Kill, ace, block, dig, assist, four kinds of error, and a 0-3 pass rating. Rotation moves itself on side-outs. Undo anything.",
  },
  {
    n: "02",
    title: "The Bank Account does the math",
    body: "Every action becomes a deposit or a withdrawal, scored against what that position is on the court to do. A libero's 2-pass is a deposit. A hitter's is just her job.",
  },
  {
    n: "03",
    title: "Report cards in the chat that night",
    body: "Six phone-sized images per player: overview, numbers, what to work on, bank account, breakdown, team comparison. Share from the app or send a link.",
  },
];

type Cell = "deposit" | "withdrawal" | "baseline" | "none";
const RULES: { action: string; libero: Cell; hitter: Cell; setterMiddle: Cell }[] = [
  { action: "Pass rated 3 (perfect)", libero: "deposit", hitter: "deposit", setterMiddle: "none" },
  { action: "Pass rated 2 (good)", libero: "deposit", hitter: "baseline", setterMiddle: "none" },
  { action: "Pass rated 0 (shank)", libero: "withdrawal", hitter: "withdrawal", setterMiddle: "none" },
  { action: "Kill, block or ace", libero: "deposit", hitter: "deposit", setterMiddle: "deposit" },
  { action: "Attack error", libero: "none", hitter: "withdrawal", setterMiddle: "withdrawal" },
  { action: "Net touch on a block", libero: "none", hitter: "withdrawal", setterMiddle: "withdrawal" },
  { action: "Serve error", libero: "withdrawal", hitter: "withdrawal", setterMiddle: "withdrawal" },
];

const BANK_POINTS = [
  "Kills, blocks and aces are deposits for everyone.",
  "Serve errors and ball-handling errors are withdrawals for everyone.",
  "A rating from Helping Team Win to Hurting Team, set by the deposit ratio, not by who the coach likes.",
];

const FAIR_POINTS = [
  "Attack and net errors never count against a libero. Passing does, and a good pass is a deposit.",
  "Works for every age group - from 12U rotation-only teams to 18U specialized positions. Flip a team to no-positions mode and everyone is scored on the same all-around formula.",
];

const INSTALL_STEPS = [
  { icon: Share, title: "iPhone and iPad", body: "Open SpikeLedger in Safari, tap Share, then Add to Home Screen." },
  { icon: EllipsisVertical, title: "Android", body: "Open it in Chrome, tap the menu, then Install app." },
  { icon: MonitorDown, title: "Laptop", body: "Click the install icon at the right end of the address bar." },
];

const COACH_PRINCIPLES = [
  { title: "Fast enough for the scorer's table", body: "Two taps per rally, and it keeps recording when the gym Wi-Fi drops." },
  { title: "Fair to every position", body: "Liberos graded as liberos, setters as setters, hitters as hitters." },
  { title: "Straight with parents", body: "Each parent sees their own kid next to team averages. Never a ranking of other kids." },
  { title: "Free for one team", body: "The full Bank Account, courtside entry and report cards, no credit card." },
];

const COURTSIDE = [
  {
    icon: Smartphone,
    title: "Big targets, built for thumbs",
    body: "Player tiles sit in real court formation, and the action pad is sized so you can hit it without looking down for long.",
  },
  {
    icon: RefreshCw,
    title: "Rotation tracks itself",
    body: "Side-out? Everyone slides one spot. Libero in and out is a single tap. The server is always marked.",
  },
  {
    icon: Undo2,
    title: "Undo anything",
    body: "Fast rallies mean fat fingers. Every tap is reversible from the undo bar, with the last ten shown.",
  },
  {
    icon: WifiOff,
    title: "Offline first",
    body: "Stats save to the phone the instant you tap and sync when the signal comes back. Nothing is lost when the gym Wi-Fi dies.",
  },
];

const CARDS = [
  { n: "01", label: "Performance Overview", caption: "Bank Account rating and the headline stats." },
  { n: "02", label: "Your Numbers", caption: "The full stat line, laid out so a parent can read it." },
  { n: "03", label: "What To Work On", caption: "Three focus areas with a drill for each, position-aware." },
  { n: "04", label: "Bank Account", caption: "Deposits and withdrawals, and where each came from." },
  { n: "05", label: "Breakdown", caption: "The mix of actions behind the balance." },
  { n: "06", label: "Team Comparison", caption: "Rank inside the position group. Optional to share." },
];

const FAQS = [
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel from the billing page - your plan stays active to the end of the period, then drops to Free. No questions asked.",
  },
  {
    q: "What happens to my data if I downgrade?",
    a: "Nothing is deleted. Every stat, match and player stays. You're back on the Free limits (1 team, 3 tournaments), and anything above those limits goes read-only until you upgrade or remove it.",
  },
  {
    q: "Do you offer team or club discounts?",
    a: "The Club tier is built for that - one subscription covers up to 15 coaches on the same data. Bigger organisation? Email us and we'll sort out a plan.",
  },
  {
    q: "Is my players' data private?",
    a: "Yes. Only you, and any coaches you invite on the Club plan, can see your team's stats. Public share links are opt-in per report and can be revoked from your dashboard.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. SpikeLedger runs in the browser on your phone and your laptop. If you want it on your home screen, add it from the browser in two taps, no app store. The courtside page is built to be used one-handed at the scorer's table.",
  },
  {
    q: "My 12U team doesn't play positions yet. Does this still work?",
    a: "Yes. Set the team to no-positions mode (the default for 12U to 14U) and every player gets the same all-around evaluation: kills, aces, blocks, assists, digs and good passes all count as deposits, every error is a withdrawal. Switch to positions later with one setting.",
  },
  {
    q: "Can parents see their kid's stats?",
    a: "Yes, on their own login. You hand a parent a short code from the roster page; they see only their child's numbers, compared to team averages, updating live during matches. Never another player's stats, never the roster, never your coaching notes.",
  },
  {
    q: "Can I import stats from a spreadsheet?",
    a: "Yes, on Coach Pro and up. Drop in a CSV or Excel file, map your columns, and a whole season backfills in a minute.",
  },
];

export default function LandingPage() {
  const year = new Date().getFullYear();
  return (
    <div className="bg-white text-slate-900">
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
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            description:
              "Volleyball stats that are fair to every position. Courtside stat entry, the Bank Account system, and six-image report cards for coaches.",
          }),
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="SpikeLedger home">
            <Wordmark size="md" />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">
              Log in
            </Link>
            <Link href="/register" className="btn-primary">
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-950 text-white">
        {/* Photo as the background. Navy sits heaviest under the copy and opens
            up toward the court on wide screens. */}
        <Image
          src={heroCourt}
          alt="A volleyball match in a bright gym, with players going up for a block at the net"
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[62%_45%]"
        />
        <div className="absolute inset-0 bg-navy-950/80 lg:bg-transparent lg:bg-gradient-to-r lg:from-navy-950 lg:via-navy-950/85 lg:to-navy-950/45" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy-950/80 to-transparent" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-14 lg:grid-cols-12 lg:items-end lg:pb-20 lg:pt-28">
          <div className="relative z-10 lg:col-span-7">
            <div className="eyebrow text-cyan-500">Built by a club coach · Free for one team</div>
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Stats that are fair to every position.{" "}
              <span className="text-cyan-500">Reports parents actually understand.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-100">
              Your libero doesn&apos;t hit. Your middle doesn&apos;t pass. SpikeLedger
              grades every player on the job she is actually on the court to do,
              then turns the numbers into a report card you can drop in the team
              chat on the drive home.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary px-6 py-3 text-base">
                Start free
                <ArrowRight size={18} strokeWidth={2} aria-hidden />
              </Link>
              <Link
                href="#reports"
                className="btn border border-white/25 px-6 py-3 text-base text-white hover:bg-white/10"
              >
                See a report card
              </Link>
            </div>
            <p className="mt-4 text-sm text-navy-300">
              1 team, 3 tournaments, the whole Bank Account system. No credit
              card, no trial clock.
            </p>
          </div>

          {/* Floating ledger card over the court */}
          <div className="relative lg:col-span-5 lg:flex lg:justify-end">
            <LedgerCard className="relative" />
          </div>
        </div>

        {/* Scoreboard strip */}
        <div className="relative border-t border-white/10 bg-navy-900">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-6 lg:grid-cols-4">
            {STRIP.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.title} className="flex items-start gap-3">
                  <Icon size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-cyan-500" aria-hidden />
                  <div>
                    <div className="font-display text-lg font-bold leading-tight">{s.title}</div>
                    <div className="text-sm text-navy-300">{s.body}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="eyebrow">How it works</div>
            <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
              From the scorer&apos;s table to the team chat, without the spreadsheet in between.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              Most of us have run the same routine: tally marks on a clipboard,
              an Excel sheet on Sunday night, then a paragraph per kid that
              nobody reads. SpikeLedger is that routine with the middle taken
              out.
            </p>
          </div>
          <ol className="divide-y divide-slate-200 lg:col-span-7">
            {STEPS.map((s) => (
              <li key={s.n} className="grid grid-cols-[4.5rem_1fr] gap-4 py-7 first:pt-0 last:pb-0">
                <div className="stat-number text-5xl font-bold leading-none text-cyan-700">{s.n}</div>
                <div>
                  <h3 className="font-display text-2xl font-bold leading-tight">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Bank Account + position-fair comparison */}
      <section id="bank" className="scroll-mt-20 bg-paper py-20 lg:py-28">
        <div className="mx-auto max-w-6xl space-y-20 px-6 lg:space-y-28">
          {/* The Bank Account (hitters) */}
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
            <PhotoPanel
              src={playerSpike}
              alt="A hitter in the air at the net, arm back, about to swing"
              sizes="(min-width: 1024px) 560px, 100vw"
              className="aspect-[3/2] lg:col-span-6"
              imgClassName="object-[45%_35%]"
              tag="Outside hitter"
              note="Kills, blocks and aces go in the bank."
            />
            <div className="lg:col-span-6">
              <div className="eyebrow">The Bank Account</div>
              <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                Every tap is a deposit or a withdrawal.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                A kill goes in the bank. A serve error comes out. What is left is
                one balance that tells you whether a player is helping the team
                win, scored against what her position is on the court to do.
              </p>
              <ul className="mt-6 space-y-3">
                {BANK_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-slate-700">
                    <Check size={18} strokeWidth={2.5} className="mt-0.5 shrink-0 text-green-600" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Position-fair comparison (liberos) */}
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            {/* min-w-0: lets the rules table scroll inside its card instead of
                widening the grid column past a phone screen. */}
            <div className="order-2 min-w-0 lg:order-1 lg:col-span-7">
              <div className="eyebrow">Position-fair comparison</div>
              <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                Your libero doesn&apos;t hit. Stop grading her like she does.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                Raw totals punish defensive players and flatter big hitters. The
                Bank Account fixes that by changing what counts, position by
                position. Same tap courtside, different rules in the ledger.
              </p>
              <ul className="mt-6 space-y-3">
                {FAIR_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-slate-700">
                    <Check size={18} strokeWidth={2.5} className="mt-0.5 shrink-0 text-green-600" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <RulesTable />
              </div>
            </div>
            <PhotoPanel
              src={playerPass}
              alt="A defender low in the stance, passing a serve off the forearms"
              sizes="(min-width: 1024px) 460px, 100vw"
              className="order-1 aspect-[3/2] lg:sticky lg:top-24 lg:order-2 lg:col-span-5 lg:aspect-[4/5] lg:self-start"
              imgClassName="object-[53%_60%]"
              tag="Libero"
              note="A 2-pass is a deposit. Attack errors never count."
            />
          </div>
        </div>
      </section>

      {/* Screens */}
      <section id="screens" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 lg:py-28">
        <div className="max-w-2xl">
          <div className="eyebrow">The app</div>
          <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
            Built for a phone in a loud gym and a laptop on Sunday night.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            No app store. It runs in the browser on whatever you already carry
            to the gym, and adds to your home screen in two taps.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          <figure className="lg:col-span-8">
            <Screenshot src={shotDashboard} alt="The SpikeLedger dashboard showing three teams, season totals and recent match results" />
            <figcaption className="mt-3 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">Dashboard.</span> Every team, the latest tournament, recent results.
            </figcaption>
          </figure>
          <figure className="lg:col-span-4 lg:row-span-2">
            <PhoneFrame src={shotEntry} alt="Courtside stat entry on a phone: score, rotation, on-court players and the action pad" className="mx-auto max-w-[300px]" />
            <figcaption className="mt-3 text-center text-sm text-slate-500">
              <span className="font-semibold text-slate-700">Courtside.</span> Score, rotation, lineup and the action pad on one screen.
            </figcaption>
          </figure>
          <figure className="lg:col-span-8">
            <Screenshot src={shotPlayer} alt="A player page with the Bank Account rating, season trend and focus areas" />
            <figcaption className="mt-3 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">Player page.</span> Bank Account, trend across tournaments, and what to work on.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Courtside */}
      <section id="courtside" className="relative scroll-mt-20 overflow-hidden bg-navy-950 text-white">
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-12 lg:items-center lg:py-28">
          <div className="lg:col-span-7">
            <div className="eyebrow text-cyan-500">Courtside entry</div>
            <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
              Two taps per rally. One hand. Gym Wi-Fi optional.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-100">
              The courtside page is the whole reason this exists. If it is slower
              than a clipboard, nobody uses it, so it is not.
            </p>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {COURTSIDE.map((c) => {
                const Icon = c.icon;
                return (
                  <li key={c.title} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-navy-950">
                      <Icon size={20} strokeWidth={2} aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-bold leading-tight">{c.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-navy-200">{c.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          {/* Courtside photo with the action pad over its corner */}
          <div className="relative mx-auto w-full max-w-md pb-10 lg:col-span-5 lg:pb-0">
            <PhotoPanel
              src={coachCourtside}
              alt="A player tossing the ball for a jump serve, with the team bench and staff courtside"
              sizes="(min-width: 1024px) 448px, 100vw"
              className="aspect-[4/5] shadow-pop"
              imgClassName="object-[45%_42%]"
            />
            <PhoneFrame
              src={shotEntryActions}
              alt="The courtside action pad: opponent error, kill, ace, block, assist, dig, four error types and the 0-3 serve-receive buttons"
              className="absolute -bottom-2 right-3 w-[44%] max-w-[200px] sm:right-5 lg:-bottom-10 lg:-right-6"
              size="sm"
              dark
            />
          </div>
        </div>
      </section>

      {/* Install on your phone */}
      <section id="install" className="scroll-mt-20 bg-paper py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-12 lg:items-center">
          <PhotoPanel
            src={phoneGym}
            alt="A player sitting in the gym, checking a phone between drills"
            sizes="(min-width: 1024px) 448px, 100vw"
            className="mx-auto aspect-[4/5] w-full max-w-md lg:col-span-5"
            imgClassName="object-[55%_30%]"
          />
          <div className="lg:col-span-7">
            <div className="eyebrow">Install on your phone</div>
            <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
              On your home screen. No app store.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              Add SpikeLedger to your home screen and it opens like any other
              app, full screen and one tap away. The courtside page keeps
              recording when the gym Wi-Fi drops, and parents who install it can
              turn on an alert for the moment a match starts.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {INSTALL_STEPS.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="card p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-navy-900 text-white">
                      <Icon size={18} strokeWidth={2} aria-hidden />
                    </span>
                    <h3 className="mt-3 font-display text-lg font-bold leading-tight">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.body}</p>
                  </li>
                );
              })}
            </ul>
            <InstallAppButton className="mt-8" />
          </div>
        </div>
      </section>

      {/* Report cards */}
      <section id="reports" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="order-2 lg:order-1 lg:col-span-6">
            {/* The people the cards are for, with the cards landing on top */}
            <div className="relative mx-auto max-w-xl pb-20 sm:pb-28">
              <PhotoPanel
                src={parentsBleachers}
                alt="Fans on their feet in the stands, cheering and waving scarves"
                sizes="(min-width: 1024px) 560px, 100vw"
                className="aspect-[4/3]"
                imgClassName="object-[42%_40%]"
              />
              <div className="absolute bottom-0 right-4 aspect-[4/5] w-[42%] max-w-[220px] sm:right-8">
                <div className="absolute inset-0 -rotate-6 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lift">
                  <Image src={cardBank} alt="" sizes="220px" className="h-full w-full object-cover" aria-hidden />
                </div>
                <div className="absolute inset-0 translate-x-3 translate-y-2 rotate-3 overflow-hidden rounded-md border border-slate-200 bg-white shadow-pop">
                  <Image
                    src={cardOverview}
                    alt="A SpikeLedger report card: Performance Overview for a libero, with the Bank Account rating and headline stats"
                    sizes="220px"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2 lg:col-span-6">
            <div className="eyebrow">WhatsApp-ready reports</div>
            <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
              Six images per player. Sized for a phone. Ready for the team chat.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              Parents don&apos;t read paragraphs on a Sunday night. They look at a
              picture. Each player gets six 1080 by 1350 cards, the size chat
              apps show full-screen without cropping.
            </p>
            <ol className="mt-7 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {CARDS.map((c) => (
                <li key={c.n} className="flex gap-3">
                  <span className="stat-number text-2xl font-bold leading-none text-cyan-700">{c.n}</span>
                  <div>
                    <div className="font-semibold leading-tight">{c.label}</div>
                    <div className="mt-0.5 text-sm text-slate-500">{c.caption}</div>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/register" className="btn-navy mt-8 px-6 py-3 text-base">
              Make the first one free
              <ArrowRight size={18} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Ask Coach AI */}
      <section className="bg-paper py-20 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <div className="eyebrow">Ask Coach AI · Coach Pro</div>
            <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
              Ask it what you&apos;d ask your assistant coach.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              It reads your team&apos;s stat lines, knows the Bank Account rules,
              and answers in plain volleyball. Position-aware, so it never tells
              a libero to work on her hitting.
            </p>
          </div>
          <div className="lg:col-span-7">
            <div className="card p-5 sm:p-6">
              <div className="flex justify-end">
                <p className="max-w-md rounded-lg rounded-br-sm bg-navy-900 px-4 py-3 text-sm text-white">
                  Who should start at libero this weekend, Jade or Sam?
                </p>
              </div>
              <div className="mt-4 flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
                  <MessageSquareText size={18} strokeWidth={2} aria-hidden />
                </span>
                <div className="rounded-lg rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                  <p>
                    <span className="font-semibold text-slate-900">Jade.</span> Over
                    the last two tournaments she is passing 2.31 to Sam&apos;s 2.02
                    and has no passes rated 0 in 41 attempts. Sam&apos;s serving is
                    the better of the two (4 aces, 1 error), so if you are short on
                    servers, bring him in at position 1 and let Jade take the rest
                    of the rotation.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Based on 8 matches · Bank Account: Jade +14, Sam +9
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built by a coach */}
      <section id="built-by-a-coach" className="scroll-mt-20 bg-navy-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-12 lg:items-center lg:py-28">
          <PhotoPanel
            src={teamHuddle}
            alt="A team huddled together with arms around each other between points"
            sizes="(min-width: 1024px) 448px, 100vw"
            className="mx-auto aspect-[4/5] w-full max-w-md lg:col-span-5"
            imgClassName="object-[50%_38%]"
          />
          <div className="lg:col-span-7">
            <div className="eyebrow text-cyan-500">Built by a coach</div>
            <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
              Built by a club coach who got tired of grading liberos on kills.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-100">
              It is shaped by what a tournament Saturday is actually like: two
              minutes between sets, a phone in one hand, and a parent asking how
              their kid did before the ball cart is packed.
            </p>
            <ul className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {COACH_PRINCIPLES.map((c) => (
                <li key={c.title} className="border-l-2 border-cyan-500 pl-4">
                  <h3 className="font-display text-xl font-bold leading-tight">{c.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-navy-200">{c.body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-navy-200">
              Coaching a team and missing something?{" "}
              <a href="mailto:support@spikeledger.com" className="font-semibold text-white underline decoration-cyan-500 underline-offset-4 hover:decoration-2">
                Tell us what your team needs
              </a>
              . Ideas from working coaches shape what gets built next.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="eyebrow">Coaches</div>
        <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
          What coaches are saying
        </h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-12">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard
              key={i}
              t={t}
              large={i === 0}
              className={i === 0 ? "lg:col-span-5 lg:row-span-2" : "lg:col-span-7"}
            />
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-paper py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <div className="eyebrow">Pricing</div>
            <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
              Free for one team. Paid when you run more than one.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              The free tier is the real product: full Bank Account, courtside
              entry, one report card per tournament. Coach Pro removes the
              limits. Club puts every coach in your club on the same data.
            </p>
          </div>
          <div className="mt-12">
            <PricingSection />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
        <div className="eyebrow">Questions</div>
        <h2 className="mt-3 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
          Things coaches ask before they sign up
        </h2>
        <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown
                  size={20}
                  strokeWidth={2}
                  className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final call */}
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center lg:py-20">
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
            Your next tournament is the easiest place to start.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-navy-200">
            Set up the roster tonight. Tap through one match this weekend. Send
            the first report cards on the drive home.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary px-6 py-3 text-base">
              Start free
              <ArrowRight size={18} strokeWidth={2} aria-hidden />
            </Link>
            <Link href="/login" className="btn border border-white/25 px-6 py-3 text-base text-white hover:bg-white/10">
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-950 py-12 text-navy-200">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-12">
          <div className="md:col-span-5">
            <Wordmark tone="light" size="sm" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-navy-300">
              Position-fair volleyball stats, built by a club coach who got
              tired of grading liberos on kills.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              { href: "#how", label: "How it works" },
              { href: "#courtside", label: "Courtside entry" },
              { href: "#reports", label: "Report cards" },
              { href: "#pricing", label: "Pricing" },
              { href: "/blog", label: "Blog" },
            ]}
          />
          <FooterCol
            title="Account"
            links={[
              { href: "/login", label: "Log in" },
              { href: "/register", label: "Create account" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { href: "/privacy", label: "Privacy policy" },
              { href: "/terms", label: "Terms of service" },
              { href: "/contact", label: "Contact" },
            ]}
          />
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t border-white/10 px-6 pt-6 text-xs text-navy-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            © {year} SpikeLedger ·{" "}
            <a href="mailto:support@spikeledger.com" className="hover:text-white">
              support@spikeledger.com
            </a>
          </div>
        </div>
      </footer>

      <InstallPrompt />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

// A real Bank Account line, the way it shows on a player page, floated over
// the hero photo. Numbers follow the engine's libero rules.
function LedgerCard({ className }: { className?: string }) {
  const rows = [
    { label: "Passes rated 2 or 3", value: "+19", tone: "text-green-700" },
    { label: "Aces", value: "+3", tone: "text-green-700" },
    { label: "Serve errors", value: "-4", tone: "text-red-700" },
    { label: "Passes rated 0", value: "-4", tone: "text-red-700" },
  ];
  return (
    <div className={cn("w-full max-w-xs rounded-lg bg-white p-4 text-slate-900 shadow-pop", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-xl font-bold leading-none">Jade · #5</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Libero · Winter Invitational</div>
        </div>
        <span className="whitespace-nowrap rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-700">
          Helping team win
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="stat-number text-5xl font-bold leading-none text-green-700">+14</span>
        <span className="text-xs text-slate-500">Bank Account balance</span>
      </div>
      <dl className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5">
            <dt className="text-slate-600">{r.label}</dt>
            <dd className={cn("stat-number text-base font-bold", r.tone)}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RulesTable() {
  const cell = (c: Cell) => {
    if (c === "deposit")
      return <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-green-700">Deposit</span>;
    if (c === "withdrawal")
      return <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-700">Withdrawal</span>;
    if (c === "baseline")
      return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-600">Baseline</span>;
    return <span className="text-xs text-slate-400">Doesn&apos;t count</span>;
  };
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-3.5">
        <div className="font-display text-lg font-bold">How the same action is scored</div>
        <div className="text-xs text-slate-500">The exact rules from the engine that scores every match.</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5 font-bold">Action</th>
              <th className="px-3 py-2.5 font-bold">Libero / DS</th>
              <th className="px-3 py-2.5 font-bold">Outside / Right side</th>
              <th className="px-3 py-2.5 font-bold">Setter / Middle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {RULES.map((r) => (
              <tr key={r.action}>
                <td className="px-5 py-3 font-medium text-slate-800">{r.action}</td>
                <td className="px-3 py-3">{cell(r.libero)}</td>
                <td className="px-3 py-3">{cell(r.hitter)}</td>
                <td className="px-3 py-3">{cell(r.setterMiddle)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A photo in a rounded panel, optionally with a caption chip in the corner.
// The panel's size comes from `className` (aspect ratio, grid span).
function PhotoPanel({
  src,
  alt,
  sizes,
  className,
  imgClassName,
  tag,
  note,
}: {
  src: typeof heroCourt;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  tag?: string;
  note?: string;
}) {
  return (
    <figure className={cn("relative overflow-hidden rounded-lg bg-navy-900 shadow-lift", className)}>
      <Image src={src} alt={alt} fill placeholder="blur" sizes={sizes} className={cn("object-cover", imgClassName)} />
      {tag && (
        <figcaption className="absolute bottom-3 left-3 right-3 max-w-xs rounded-md bg-white/95 px-3 py-2 shadow-card sm:bottom-4 sm:left-4 sm:right-auto">
          <div className="font-display text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">{tag}</div>
          <div className="mt-0.5 text-sm font-medium leading-snug text-slate-900">{note}</div>
        </figcaption>
      )}
    </figure>
  );
}

function Screenshot({ src, alt }: { src: typeof shotDashboard; alt: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-card">
      <Image src={src} alt={alt} sizes="(min-width: 1024px) 66vw, 100vw" className="block h-auto w-full" />
    </div>
  );
}

function PhoneFrame({
  src,
  alt,
  className,
  dark = false,
  size = "md",
}: {
  src: typeof shotEntry;
  alt: string;
  className?: string;
  dark?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "overflow-hidden bg-navy-950 shadow-pop",
        size === "sm" ? "rounded-[1.5rem] border-[6px]" : "rounded-[2.25rem] border-[10px]",
        dark ? "border-navy-800" : "border-navy-950",
        className,
      )}
    >
      <Image src={src} alt={alt} sizes="320px" className="block h-auto w-full" aria-hidden={alt === "" ? true : undefined} />
    </div>
  );
}

function TestimonialCard({
  t,
  large,
  className,
}: {
  t: (typeof TESTIMONIALS)[number];
  large: boolean;
  className?: string;
}) {
  const empty = !t.quote;
  return (
    <figure className={cn("card flex flex-col justify-between p-6", large && "lg:p-8", className)}>
      <blockquote
        className={cn(
          "font-display font-semibold leading-snug",
          large ? "text-2xl sm:text-3xl" : "text-xl",
          empty ? "italic text-slate-400" : "text-slate-900",
        )}
      >
        {empty
          ? "“Your quote goes here. Two or three sentences about what changed for your team.”"
          : `“${t.quote}”`}
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        {t.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400">
            <User size={20} strokeWidth={2} aria-hidden />
          </span>
        )}
        <div>
          <div className={cn("font-semibold", empty ? "text-slate-400" : "text-slate-900")}>
            {t.name || "Coach name"}
          </div>
          <div className="text-sm text-slate-500">{t.team || "Team · Club"}</div>
        </div>
      </figcaption>
    </figure>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="md:col-span-2">
      <div className="eyebrow text-navy-400">{title}</div>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-navy-200 hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
