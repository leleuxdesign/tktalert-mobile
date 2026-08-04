/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // TKTAlert design tokens — matches web app
        background: "#0d1b2a",      // deep navy
        surface: "#1a2e42",         // card/elevated surface
        border: "#2a3f55",          // subtle border
        foreground: "#f0ece4",      // warm white (Ledger cream)
        muted: "#8a9bb0",           // secondary text
        primary: "#22c55e",         // alert green
        "primary-dark": "#16a34a",  // pressed green
        warning: "#f59e0b",         // amber warning
        error: "#ef4444",           // red error
        success: "#22c55e",         // same as primary
      },
      fontFamily: {
        mono: ["Courier New", "monospace"],
        sans: ["System", "sans-serif"],
      },
    },
  },
  plugins: [],
};
