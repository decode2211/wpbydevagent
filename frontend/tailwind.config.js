/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme premium colors
        dark: {
          50: "#f8fafc",
          100: "#f1f5f9",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617"
        },
        whatsapp: {
          DEFAULT: "#25D366",
          dark: "#075E54",
          light: "#DCF8C6",
          chatbg: "#efeae2",
          darkchatbg: "#0b141a",
          bubblein: "#202c33",
          bubbleout: "#005c4b"
        }
      }
    },
  },
  plugins: [],
}
