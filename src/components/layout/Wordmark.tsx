import { cn } from "@/lib/utils";

// Brand art. Both horizontal logos are cut from the designer's sheet by
// scripts/extract-brand-assets.mjs and live in public/: navy "Spike" for
// light surfaces, white "Spike" for navy surfaces. Same canvas, so one
// aspect ratio serves both.
//
// The @2x copies are exported at twice the largest size the wordmark is ever
// drawn (52px tall) and every use pins width and height in CSS pixels, so
// retina screens get real pixels and the browser never rescales the file.
export const LOGO_RATIO = 418 / 104;
const HEIGHTS = { sm: 32, md: 40, lg: 52 } as const;

// Circular icon on its own (transparent outside the ring).
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-icon.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}

// Full horizontal logo. tone = "dark" is the navy-text version for light
// surfaces (default); "light" is the white-text version for navy surfaces.
export function Wordmark({
  tone = "dark",
  size = "md",
  className,
}: {
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const height = HEIGHTS[size];
  const width = Math.round(height * LOGO_RATIO);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === "light" ? "/logo-full-on-dark@2x.png" : "/logo-full@2x.png"}
      alt="SpikeLedger"
      width={width}
      height={height}
      className={cn("inline-block shrink-0", className)}
      style={{ width, height }}
    />
  );
}
