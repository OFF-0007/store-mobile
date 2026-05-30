/** @type {import('tailwindcss').Config} */
module.exports = {
  // Include all files that use NativeWind classes
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand palette
        primary: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        accent: {
          DEFAULT: "#6366f1",
          light:   "#818cf8",
          dark:    "#4f46e5",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        danger:  "#ef4444",
        // Light mode surface colors
        surface: {
          DEFAULT: "#f8fafc",
          card:    "#ffffff",
          border:  "#e2e8f0",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
