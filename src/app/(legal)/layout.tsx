// Shared shell for the public legal/support/blog pages (/privacy, /terms,
// /contact, /blog): wordmark header, readable column, site footer.

import Link from "next/link";
import { Wordmark } from "@/components/layout/Wordmark";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
          <Link href="/" aria-label="SpikeLedger home">
            <Wordmark size="sm" />
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/blog" className="text-slate-600 hover:text-slate-900">
              Blog
            </Link>
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Log in
            </Link>
            <Link href="/register" className="btn-primary px-3 py-1.5">
              Start free
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
