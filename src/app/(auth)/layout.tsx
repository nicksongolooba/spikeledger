import Link from "next/link";
import { Wordmark } from "@/components/layout/Wordmark";
import { SiteFooter } from "@/components/layout/SiteFooter";

// Auth pages: a plain light shell with the wordmark up top and the form in a
// centered card. No hero photo here - coaches arrive from the landing page
// and just want the form.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" aria-label="SpikeLedger home">
            <Wordmark size="md" />
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to site
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
