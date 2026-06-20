/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1a56a4', light: '#2d72d2', dark: '#0f3671' },
        secondary: '#f0f4fa',
        accent: '#e8b84b',
      },
      fontFamily: { sans: ['Arial', 'sans-serif'] }
    },
  },
  plugins: [],
}
