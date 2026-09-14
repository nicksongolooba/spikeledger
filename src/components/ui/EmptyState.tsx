import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <div className="mb-4 text-slate-400">{icon}</div>}
      <h3 className="font-display text-xl font-bold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
