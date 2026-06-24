import Link from "next/link";

// Bottom-of-post call to action. Same on every post so the conversion path is
// consistent: "Try SpikeLedger Free" -> /register.
export function BlogCTA() {
  return (
    <aside className="mt-12 overflow-hidden rounded-2xl border border-volt-400/30 bg-gradient-to-br from-volt-400/10 to-slate-900/40 p-6 sm:p-8">
      <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
        Put these numbers to work
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
        SpikeLedger turns your match stats into position-fair feedback every
        player can use - the Bank Account system, courtside stat entry, and
        share-ready report cards. Free for your first team, no credit card.
      </p>
      <Link
        href="/register"
        className="btn-primary mt-5 inline-flex px-5 py-2.5 text-base"
      >
        Try SpikeLedger Free
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
            clipRule="evenodd"
          />
        </svg>
      </Link>
    </aside>
  );
}
