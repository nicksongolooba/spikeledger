import { Volleyball } from "lucide-react";
import { cn } from "@/lib/utils";

// Brand mark + wordmark. The mark is a white volleyball glyph on an orange
// disc; the wordmark is set in the condensed display face with "Spike" heavy
// and "Ledger" light. Everything is vector + live text, so it stays crisp at
// any size and inherits the surface it sits on (tone = "dark" ink on light
// surfaces, "light" white on navy).
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-orange-500 text-white",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Volleyball size={Math.round(size * 0.66)} strokeWidth={2.25} />
    </span>
  );
}

export function Wordmark({
  tone = "dark",
  size = "md",
  className,
}: {
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const mark = { sm: 26, md: 32, lg: 44 }[size];
  const text = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" }[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={mark} />
      <span
        className={cn(
          "font-display uppercase leading-none tracking-tight",
          text,
          tone === "dark" ? "text-navy-950" : "text-white",
        )}
      >
        <span className="font-extrabold">Spike</span>
        <span className="font-medium">Ledger</span>
      </span>
      <span className="sr-only">SpikeLedger</span>
    </span>
  );
}
