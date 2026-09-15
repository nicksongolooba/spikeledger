import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-cyan-700"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-slate-800" : ""}>{item.label}</span>
            )}
            {!isLast && (
              <ChevronRight size={14} strokeWidth={2} className="text-slate-400" aria-hidden />
            )}
          </span>
        );
      })}
    </nav>
  );
}
