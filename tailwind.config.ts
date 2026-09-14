import type { Config } from "tailwindcss";

// SpikeLedger brand tokens - "Scoreboard" system (Sept 2026 redesign).
//
// Light UI. Deep navy is the primary brand color (solid surfaces, sidebar,
// hero bands, headline ink). Volleyball-leather orange is the single accent
// (calls to action, active states, eyebrows). Tailwind's default `slate`
// scale carries every neutral in its normal direction: 900 for headings, 600
// for body copy, 500 muted, 200 borders, 50 insets. Semantic colors use the
// stock scales (emerald = deposits, red = withdrawals, amber = warnings).
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
        orange: {
          50: "#fff4ec",
          100: "#ffe5d3",
          200: "#ffc9a6",
          300: "#ffa572",
          400: "#ff7d3d",
          500: "#e4520b", // accent - white text passes 3.8:1
          600: "#c8440a", // hover
          700: "#a33808", // accent text on light surfaces (6.5:1)
          800: "#7f2d0a",
          900: "#66260b",
          950: "#381203",
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
