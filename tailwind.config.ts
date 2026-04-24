import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#f6f8fc",
        ink: "#172033",
        primary: {
          DEFAULT: "#2f7d5b",
          soft: "#e1f0dc"
        },
        success: {
          DEFAULT: "#15803d",
          soft: "#dcfce7"
        },
        danger: {
          DEFAULT: "#b91c1c",
          soft: "#fee2e2"
        },
        warning: {
          DEFAULT: "#b45309",
          soft: "#fef3c7"
        }
      },
      boxShadow: {
        panel: "0 12px 32px rgba(15, 23, 42, 0.08)"
      },
      borderRadius: {
        panel: "1.25rem"
      }
    }
  },
  plugins: []
};

export default config;
