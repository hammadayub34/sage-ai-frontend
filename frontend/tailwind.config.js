/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0a0a',        // Pure black background
        'dark-panel': '#1a1a1a',     // Dark grey panels
        'dark-border': '#2a2a2a',    // Subtle borders
        'dark-text': '#e5e5e5',      // Light grey text
        'midnight': {
          50: '#0a0a0a',
          100: '#141414',
          200: '#1a1a1a',
          300: '#242424',
          400: '#2a2a2a',
          500: '#333333',
          600: '#404040',
          700: '#4a4a4a',
          800: '#555555',
          900: '#666666',
        },
      },
    },
  },
  plugins: [],
}

