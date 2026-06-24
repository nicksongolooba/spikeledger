import Link from "next/link";

// Compact legal/support footer rendered on every page (app shell, auth,
// legal pages). The landing page has its own richer footer with these same
// links baked in.
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800/60 py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center text-xs text-slate-500 sm:flex-row sm:justify-between sm:text-left">
        <div>© {new Date().getFullYear()} SpikeLedger</div>
        <nav className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/blog" className="hover:text-slate-300">
            Blog
          </Link>
          <Link href="/privacy" className="hover:text-slate-300">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-slate-300">
            Terms of Service
          </Link>
          <Link href="/contact" className="hover:text-slate-300">
            Contact
          </Link>
          <a href="mailto:support@spikeledger.com" className="hover:text-slate-300">
            support@spikeledger.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
