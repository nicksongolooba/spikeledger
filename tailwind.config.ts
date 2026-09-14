import type { Config } from "tailwindcss";

// SpikeLedger brand tokens - "Scoreboard" system (Sept 2026 redesign).
//
// Light UI. Deep navy is the primary brand color (solid surfaces, sidebar,
// hero bands, headline ink). The logo's cyan is the primary accent (calls to
// action, active states, eyebrows, links) and its green the secondary accent
// (deposits, wins, second chart series). Both scales are built around the
// exact colours sampled from the logo sheet at the 500 stop; the 500s are
// light, so fills carry navy-950 text and text on white uses the 700s.
// Tailwind's default `slate` scale carries every neutral in its normal
// direction: 900 for headings, 600 for body copy, 500 muted, 200 borders,
// 50 insets. Red = withdrawals/losses, amber = warnings, stock scales.
//
// Type: Barlow (body) + Barlow Condensed (display, big numbers, eyebrows),
// loaded through next/font in app/layout.tsx and exposed as CSS variables.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-barlow)", "system-ui", "Segoe UI", "sans-serif"],
        display: [
          "var(--font-barlow-condensed)",
          "var(--font-barlow)",
          "Impact",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        // App page background: a hair cooler and darker than white so white
        // cards read as cards without heavy shadows.
        paper: "#f4f6f9",
        navy: {
          50: "#eef2f8",
          100: "#dbe3ef",
          200: "#b9c8de",
          300: "#8ba3c5",
          400: "#5d7ba6",
          500: "#3d5c8a",
          600: "#2b466f",
          700: "#1f3557",
          800: "#152743",
          900: "#0b1a33", // primary solid
          950: "#071022", // sidebar / footer
        },
        cyan: {
          50: "#ebfbff",
          100: "#d1f6ff",
          200: "#a3ecff",
          300: "#66e0ff",
          400: "#29d4ff",
          500: "#00cafd", // exact logo cyan - fills, on-navy text; pair fills with navy-950 text
          600: "#02a6cf", // hover fill
          700: "#047895", // accent text on light surfaces (4.6:1 on paper)
          800: "#065e74", // hover text
          900: "#074150",
          950: "#062932",
        },
        green: {
          50: "#e8fcf2",
          100: "#cdf9e2",
          200: "#a5f3ca",
          300: "#6eecab",
          400: "#41e790",
          500: "#25e380", // exact logo green - fills, on-navy text, second chart series
          600: "#1b9757", // fills with white text (3.7:1)
          700: "#1a7f4a", // text on light surfaces
          800: "#17633c", // dark text / ramp
          900: "#114028",
          950: "#0c2719",
        },
        // Older code and branches still say `emerald` for deposits/wins; keep
        // that on the brand green rather than Tailwind's stock scale.
        emerald: {
          50: "#e8fcf2",
          100: "#cdf9e2",
          200: "#a5f3ca",
          300: "#6eecab",
          400: "#41e790",
          500: "#25e380",
          600: "#1b9757",
          700: "#1a7f4a",
          800: "#17633c",
          900: "#114028",
          950: "#0c2719",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        lift: "0 12px 32px -14px rgba(11, 26, 51, 0.28)",
        pop: "0 24px 60px -24px rgba(11, 26, 51, 0.45)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
