import type { Config } from "tailwindcss";

const preset = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // v1 视觉系统：primary 退役为白系（保留键名以兼容既有 primary-* 引用）
        // 仅 DEFAULT/500/600 用于实色填充与 hover；其余档位提供渐进透明度 fallback
        primary: {
          DEFAULT: "#ffffff",
          50: "#ffffff",
          100: "#fafafa",
          200: "#f5f5f5",
          300: "#e5e5e5",
          400: "#d4d4d4",
          500: "#ffffff",
          600: "#fafafa",
          700: "#e5e5e5",
          800: "#a3a3a3",
          900: "#737373",
        },
        dark: {
          DEFAULT: "#0a0a0a",
          50: "#141414",
          100: "#1a1a1a",
          200: "#262626",
          300: "#404040",
          400: "#525252",
          500: "#737373",
          600: "#a3a3a3",
          700: "#d4d4d4",
          800: "#e5e5e5",
          900: "#ededed",
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
} satisfies Partial<Config>;

export default preset;
