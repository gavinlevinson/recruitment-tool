/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  "#e8edf5",
          100: "#c5d1e6",
          200: "#9fb2d5",
          300: "#7893c4",
          400: "#577cb7",
          500: "#3564aa",
          600: "#2a5099",
          700: "#1e3a7a",
          800: "#14285c",
          900: "#0d1c42",
          950: "#080e25",
        },
        skyblue: {
          light: "#bfdbf7",
          DEFAULT: "#7fb3d3",
          medium: "#5b9ec9",
        },
        violet: {
          light: "#d8c8f0",
          DEFAULT: "#8b6bbf",
          medium: "#7253a8",
          dark: "#5a3e8a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        matte: "0 2px 8px rgba(14, 30, 66, 0.10)",
        "matte-md": "0 4px 16px rgba(14, 30, 66, 0.12)",
        "matte-lg": "0 8px 32px rgba(14, 30, 66, 0.14)",
      },
    },
  },
  plugins: [],
};
