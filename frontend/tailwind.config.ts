import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0A0A0F",
        "bg-card": "#13131A",
        "bg-elevated": "#1C1C27",
        "bg-hover": "#22222F",
        "accent-purple": "#6C5CE7",
        "accent-purple-light": "#8B7CF6",
        "accent-blue": "#4ECDC4",
        "accent-green": "#00B894",
        "accent-red": "#FF6B6B",
        "accent-yellow": "#FDCB6E",
        "text-primary": "#FFFFFF",
        "text-secondary": "#A0A0B0",
        "text-muted": "#606070",
        border: "#2A2A3A",
      },
      fontFamily: {
        heading: ["Nunito", "sans-serif"],
        body: ["Inter", "sans-serif"],
        score: ["Space Grotesk", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "20px",
        xl: "28px",
      },
      animation: {
        "bounce-idle": "bounceIdle 2s ease-in-out infinite",
        "pop-in": "popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        "winner-reveal": "winnerReveal 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;