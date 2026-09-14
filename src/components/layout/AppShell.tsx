"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/layout/Wordmark";
import { SiteFooter } from "@/components/layout/SiteFooter";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: { href: string; label: string; icon: LucideIcon }[];
}

const CLUB_ITEM: NavItem = { href: "/club", label: "Club", icon: Building2 };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    children: [{ href: "/settings/billing", label: "Billing", icon: CreditCard }],
  },
];

// App chrome: a navy sidebar on desktop (the one dark surface in the app -
// it frames the light content like a scoreboard frames the court), a slim
// white top bar plus bottom tab bar on phones.
export function AppShell({
  user,
  showClub = false,
  children,
}: {
  user: { email: string; name: string | null };
  showClub?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = showClub ? [NAV[0], CLUB_ITEM, ...NAV.slice(1)] : NAV;
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const initials = (user.name ?? user.email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-paper">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-navy-950 text-white lg:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Link href="/dashboard" aria-label="SpikeLedger dashboard">
            <Wordmark tone="light" size="sm" />
          </Link>
        </div>
        <nav className="flex-1 px-3 py-5">
          <div className="eyebrow mb-2 px-3 text-navy-300">Coach</div>
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "relative mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/10 text-white"
                      : "text-navy-200 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {active && (
                    <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-orange-500" />
                  )}
                  <Icon size={18} strokeWidth={2} />
                  {item.label}
                </Link>
                {item.children?.map((child) => {
                  const ChildIcon = child.icon;
                  const childActive = pathname.startsWith(child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "mb-0.5 ml-4 flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        childActive
                          ? "text-white"
                          : "text-navy-300 hover:text-white",
                      )}
                    >
                      <ChildIcon size={16} strokeWidth={2} />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700 font-display text-sm font-bold text-white">
              {initials || "C"}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {user.name ?? "Coach"}
              </div>
              <div className="truncate text-xs text-navy-300">{user.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-navy-200 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} strokeWidth={2} />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" aria-label="SpikeLedger dashboard">
          <Wordmark size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <LogOut size={16} strokeWidth={2} />
          Log out
        </button>
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:pt-8">
          {children}
        </div>
        <div className="mb-20 lg:mb-0">
          <SiteFooter />
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold",
                active ? "text-orange-700" : "text-slate-500",
              )}
            >
              {active && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-orange-500" />
              )}
              <Icon size={20} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
