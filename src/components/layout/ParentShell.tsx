"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Heart, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/layout/Wordmark";
import { SiteFooter } from "@/components/layout/SiteFooter";

// Parent chrome: a slim top bar, no sidebar, no coach tools. Parents only
// ever navigate between their players and their own settings.
export function ParentShell({
  user,
  children,
}: {
  user: { email: string; name: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = [
    { href: "/parent", label: "My players", icon: Heart, active: pathname === "/parent" || pathname.startsWith("/parent/player") },
    { href: "/parent/settings", label: "Settings", icon: Settings, active: pathname.startsWith("/parent/settings") },
  ];
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/parent" aria-label="SpikeLedger - my players">
            <Wordmark size="sm" />
          </Link>
          <nav className="flex items-center gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    item.active ? "bg-navy-50 text-navy-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon size={16} strokeWidth={2} aria-hidden />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              title={user.email}
            >
              <LogOut size={16} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6 lg:pt-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
