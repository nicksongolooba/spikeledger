// Shared shell for the public legal/support pages (/privacy, /terms,
// /contact): simple logo header, readable column, site footer.

import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="border-b border-slate-800/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-full.png"
              alt="SpikeLedger"
              width={556}
              height={141}
              priority
              className="h-8 w-auto"
            />
          </Link>
          <Link href="/login" className="text-sm text-slate-400 hover:text-slate-200">
            Log in
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
