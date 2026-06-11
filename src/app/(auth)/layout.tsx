import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-volt-400/10 blur-[120px]" />
      </div>
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
        </div>
      </header>
      <main className="relative z-10 flex flex-1 items-start justify-center px-4 pb-12 pt-6 sm:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
