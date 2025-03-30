/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FF6B6B",
          light: "#FF8787",
          dark: "#FA5252",
        },
        secondary: {
          DEFAULT: "#4ECDC4",
          light: "#86E3DE",
          dark: "#45B7AF",
        },
        accent: {
          DEFAULT: "#FFE66D",
          light: "#FFF3A3",
          dark: "#FFD93D",
        },
        background: {
          DEFAULT: "#F8F9FA",
          dark: "#343A40",
        },
        text: {
          DEFAULT: "#212529",
          light: "#495057",
          lighter: "#868E96",
        },
      },
    },
  },
  plugins: [],
};
