import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F5F2EA",
        surface: "#EBE5D8",
        "surface-raised": "#E1DBCB",
        border: "#D5CDBE",
        primary: {
          DEFAULT: "#EF9F27",
          50: "#FEF8ED",
          100: "#FDF0D5",
          200: "#FBDFA8",
          300: "#F8C76F",
          400: "#F5AE40",
          500: "#EF9F27",
          600: "#D4820C",
          700: "#B0670A",
          800: "#8E520E",
          900: "#744410",
        },
        teal: {
          DEFAULT: "#1D9E75",
          50: "#EDFAF4",
          100: "#D5F4E6",
          200: "#ADE8CE",
          300: "#76D5AD",
          400: "#3DBC8A",
          500: "#1D9E75",
          600: "#107F5E",
          700: "#0C664D",
          800: "#0B523F",
          900: "#0A4435",
        },
        safe: {
          DEFAULT: "#639922",
          light: "#EEF5E1",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light: "#FEF8E7",
        },
        critical: {
          DEFAULT: "#E24B4A",
          light: "#FDEEEE",
        },
        text: {
          DEFAULT: "#1C1C1A",
          muted: "#6B6B65",
          light: "#9B9B95",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-raised": "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.04)",
        panel: "0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.05)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
