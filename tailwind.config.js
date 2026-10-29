/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // The theme is driven by `data-theme` on <html> (see ThemeContext), not the
  // media query, so the toggle in the top bar is the single source of truth.
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Electric amber - primary brand colour (Section 3.5).
        // Tuned to the Outages workspace palette: #FFBB02 base, #FFD400 hover.
        primary: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FFD400',
          500: '#FFBB02',
          600: '#E0A802',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
        // Dark navy - text, sidebar, headers.
        // High stops follow the Outages workspace: #03041A canvas, #0B0D20
        // topbar, #1C1D30 card surface, #31324C panel tint.
        navy: {
          50: '#F4F6FA',
          100: '#E4E9F2',
          200: '#C8D2E2',
          300: '#9CAAC4',
          400: '#6C7C9B',
          500: '#4A5A78',
          600: '#3D3F5C',
          700: '#31324C',
          800: '#1C1D30',
          900: '#0B0D20',
          950: '#03041A',
        },
        // Status colours - keyed to the Outages workspace accents:
        // success #34FB34, warning #FFBB02 (the amber), danger #FF2E1F, info #22D3EE.
        success: {
          50: '#EFFEF0',
          100: '#D9FEDC',
          200: '#B4FEB9',
          500: '#34FB34',
          600: '#2BD62B',
          700: '#1FA31F',
        },
        warning: {
          50: '#FFF8E0',
          100: '#FFEFB8',
          200: '#FFE585',
          500: '#FFBB02',
          600: '#E0A802',
          700: '#B48602',
        },
        danger: {
          50: '#FFEDEA',
          100: '#FFD6D2',
          200: '#FFB9B2',
          500: '#FF2E1F',
          600: '#E0240F',
          700: '#B31D0C',
        },
        info: {
          50: '#E9FBFE',
          100: '#D2F6FD',
          200: '#ABEFFB',
          500: '#22D3EE',
          600: '#14AECA',
          700: '#0F8AA3',
        },
        // Neutrals
        canvas: '#F6F7F9',
        surface: '#FFFFFF',
      },
      fontFamily: {
        // Montserrat is the app face (the Outages workspace standard).
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        montserrat: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // Match the Outages workspace geometry: cards are rounded-2xl (16px),
      // controls are rounded-xl (12px). Used by every shared UI component.
      borderRadius: {
        card: '16px',
        control: '12px',
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
        'dialog-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
        'slide-in-right': 'slide-in-right 180ms ease-out',
        'toast-in': 'toast-in 180ms ease-out',
        'dialog-in': 'dialog-in 220ms ease-out',
      },
    },
  },
  plugins: [],
};
