// SakuKampus UMY - Tailwind Config (Hokkaido Soft Clean Blue & White Minimalist Theme)
// Dominant White, Soft Sky Blue, Crisp Cobalt Accents

tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F0F7FF', // Ultra-soft ice blue
          100: '#E0F2FE', // Soft sky mist
          200: '#BAE6FD', // Pastel sky blue
          300: '#7DD3FC', // Hokkaido clear sky
          400: '#38BDF8', // Vivid sky blue
          500: '#0EA5E9', // Ocean blue
          600: '#2563EB', // Hokkaido poster primary royal blue
          700: '#1D4ED8', // Deep royal blue
          800: '#1E40AF', // Midnight blue
          900: '#1E3A8A', // Deep navy
          950: '#0F172A'  // Deep slate navy
        },
        sky: {
          DEFAULT: '#38BDF8',
          light: '#E0F2FE',
          soft: '#BAE6FD',
          dark: '#0284C7'
        },
        sand: {
          DEFAULT: '#FFFFFF', // Pure clean white
          dark: '#E2EEF9'     // Soft blue-white border
        },
        cream: {
          DEFAULT: '#F8FAFC'  // Pure snow white field
        },
        ink: {
          DEFAULT: '#0F172A', // Crisp slate navy typography
          light: '#334155'
        },
        konbini: {
          DEFAULT: '#FB923C', // Warm orange store accent from Hokkaido poster
          light: '#FED7AA'
        },
        // Dark mode palette - Deep night blue & neon ice accents
        nightbg:   { DEFAULT: '#0B132B', card: '#111C3A', card2: '#1C2B54' },
        nighttext: { DEFAULT: '#F0F7FF' },
        nightaccent:{ DEFAULT: '#38BDF8' },
        // Semantic financial colors
        income:  { DEFAULT: '#059669', light: '#34D399' },
        expense: { DEFAULT: '#DC2626', light: '#F87171' },
      },
      fontFamily: {
        pixel:   ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        label:   ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        sans:    ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        body:    ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'card-lg': '20px',
        'pill': '9999px',
        'btn': '10px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(37, 99, 235, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 6px 16px -2px rgba(37, 99, 235, 0.08), 0 2px 6px -2px rgba(0, 0, 0, 0.03)',
        'card-dark': '0 1px 3px rgba(0, 0, 0, 0.4)',
        'btn': '0 1px 2px rgba(37, 99, 235, 0.12)',
        'btn-active': 'none',
        'btn-danger': '0 1px 2px rgba(220, 38, 38, 0.2)',
        'pressed': 'inset 0 1px 2px rgba(0, 0, 0, 0.08)',
        'float': '0 12px 30px -5px rgba(37, 99, 235, 0.15), 0 8px 12px -6px rgba(0, 0, 0, 0.05)',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      }
    }
  }
};
