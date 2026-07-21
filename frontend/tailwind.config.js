/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          background: '#060B18',     // Deep space base canvas
          surface: '#0B1535',        // Sidebar, TopBar, elevated surface background
          cards: '#101C40',          // Unified poster cards background
          accent: '#3B82F6',         // Electric Blue highlight
          text: '#FFFFFF',           // Primary text
          textMuted: '#A8B3CF',      // Muted Secondary text
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
