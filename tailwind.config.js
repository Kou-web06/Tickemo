/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app.json", "./<custom-folder>/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ios: {
          background: '#F2F2F7',
          card: '#FFFFFF',
          label: '#000000',
          secondary: '#8E8E93',
          border: '#E5E5EA',
          tint: '#007AFF',
        },
      },
    },
  },
  plugins: [],
}
