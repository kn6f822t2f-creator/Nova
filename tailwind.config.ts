import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#05070b",
        abyss: "#0a0e17",
        depth: "#121826",
        reef: "#1b2437",
        glow: "#4ade80",
        gold: "#fbbf24",
        crimson: "#ef4444",
      },
      fontFamily: {
        display: ['"Orbitron"', "system-ui", "sans-serif"],
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(74, 222, 128, 0.6)" },
          "50%": { boxShadow: "0 0 24px 8px rgba(74, 222, 128, 0.4)" },
        },
      },
      animation: {
        shimmer: "shimmer 2s ease-in-out infinite",
        pulseGlow: "pulseGlow 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
