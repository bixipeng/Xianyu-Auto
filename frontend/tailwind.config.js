/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#FFE815',
        'brand-dark': '#E6D013',
      },
    },
  },
  plugins: [],
}
