/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        saffron: {
          DEFAULT: '#E8741A',
          light: '#F59242',
          dark: '#C45E0E',
          50: '#FEF3E8',
        },
        maroon: {
          DEFAULT: '#7A1F2B',
          light: '#9B2D3C',
          dark: '#5C1620',
          50: '#F9EAEC',
        },
        gold: {
          DEFAULT: '#C9962B',
          light: '#DEB554',
          dark: '#A87820',
          50: '#FDF6E7',
        },
        cream: {
          DEFAULT: '#FFF8EC',
          dark: '#F5EDDA',
          darker: '#EDE0C4',
        },
        brown: {
          DEFAULT: '#2B1A14',
          light: '#4A2E23',
          medium: '#6B4226',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
