const config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4FD1C5',
          dark: '#319795',
          light: '#81E6D9'
        }
      }
    }
  },
  plugins: []
};

export default config;
