import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[120px]" />
      </div>
      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400 text-cyan-950">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 2L2 7v6c0 5.5 4 9 10 11 6-2 10-5.5 10-11V7l-10-5z" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">SpikeLedger</span>
          </Link>
        </div>
      </header>
      <main className="relative z-10 flex flex-1 items-start justify-center px-4 pb-12 pt-6 sm:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
