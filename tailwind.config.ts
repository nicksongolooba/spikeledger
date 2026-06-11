import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        // "Prime Court" palette. `slate` is overridden with navy-tinted inks
        // so every existing slate-* class restyles app-wide: deep navy-ink
        // backgrounds at the dark end, warm (not pure) whites at the light
        // end. Volt is the primary accent (electric yellow-green - volleyball
        // energy, readable in bright gyms); gold marks AI/premium surfaces.
        slate: {
          50: "#faf9f4",
          100: "#f4f3ed", // warm white - main text
          200: "#dbe0e8",
          300: "#b6c0d1",
          400: "#8a97ad",
          500: "#5d6d8f",
          600: "#3c4f78",
          700: "#2a3a5e",
          800: "#1b2742",
          900: "#121b30",
          950: "#0c1220", // deep navy-ink - app background
        },
        volt: {
          50: "#fafdea",
          100: "#f4fcd0",
          200: "#e9f9a3",
          300: "#dff871",
          400: "#cbf03c", // primary accent
          500: "#aed622",
          600: "#88ab15",
          700: "#678114",
          800: "#526617",
          900: "#465718",
          950: "#1a2403", // text on volt
        },
        gold: {
          50: "#fdf9eb",
          100: "#fbf0c9",
          200: "#fbe3a4",
          300: "#f8cf6e",
          400: "#f3b53b",
          500: "#dd9418",
          600: "#bf7112",
          700: "#985112",
          800: "#7c4016",
          900: "#693518",
          950: "#3b2704", // text on gold
        },
        // semantic aliases on top of the ink scale
        surface: {
          DEFAULT: "#121b30", // slate-900
          elevated: "#1b2742", // slate-800
          border: "#2a3a5e", // slate-700
        },
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
