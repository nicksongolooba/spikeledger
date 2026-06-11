import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-volt-400"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-slate-200" : ""}>{item.label}</span>
            )}
            {!isLast && <span className="text-slate-600">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
