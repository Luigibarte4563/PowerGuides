/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // The theme is driven by `data-theme` on <html> (see ThemeContext), not the
  // media query, so the toggle in the top bar is the single source of truth.
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Electric amber - primary brand colour (Section 3.5)
        primary: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
        // Dark navy - text, sidebar, headers
        navy: {
          50: '#F4F6FA',
          100: '#E4E9F2',
          200: '#C8D2E2',
          300: '#9CAAC4',
          400: '#6C7C9B',
          500: '#4A5A78',
          600: '#33415C',
          700: '#223049',
          800: '#16233B',
          900: '#101B2D',
          950: '#0A1220',
        },
        // Status colours
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        // Neutrals
        canvas: '#F6F7F9',
        surface: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        control: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 27, 45, 0.04), 0 4px 16px rgba(16, 27, 45, 0.06)',
        'card-hover': '0 2px 4px rgba(16, 27, 45, 0.06), 0 12px 28px rgba(16, 27, 45, 0.10)',
        pop: '0 10px 30px rgba(16, 27, 45, 0.18)',
        // Dark surfaces need a deeper, blacker shadow - the light tokens are too
        // faint to separate a card from the dark canvas.
        'card-dark': '0 1px 2px rgba(0, 0, 0, 0.40), 0 4px 16px rgba(0, 0, 0, 0.30)',
        'card-hover-dark': '0 2px 4px rgba(0, 0, 0, 0.45), 0 12px 28px rgba(0, 0, 0, 0.45)',
        'pop-dark': '0 10px 30px rgba(0, 0, 0, 0.60)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
        'slide-in-right': 'slide-in-right 180ms ease-out',
        'toast-in': 'toast-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};
