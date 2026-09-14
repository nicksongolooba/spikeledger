import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Bottom-of-post call to action. Same on every post so the conversion path is
// consistent: "Try SpikeLedger free" -> /register.
export function BlogCTA() {
  return (
    <aside className="mt-12 overflow-hidden rounded-lg bg-navy-900 p-6 text-white sm:p-8">
      <div className="eyebrow text-orange-300">Put these numbers to work</div>
      <h2 className="mt-2 font-display text-3xl font-bold leading-none tracking-tight sm:text-4xl">
        Free for your first team. No credit card.
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-navy-100 sm:text-base">
        SpikeLedger turns your match stats into position-fair feedback every
        player can use: the Bank Account, courtside stat entry, and report
        cards ready for the team chat.
      </p>
      <Link href="/register" className="btn-primary mt-6 inline-flex px-5 py-2.5 text-base">
        Try SpikeLedger free
        <ArrowRight size={18} strokeWidth={2} aria-hidden />
      </Link>
    </aside>
  );
}
