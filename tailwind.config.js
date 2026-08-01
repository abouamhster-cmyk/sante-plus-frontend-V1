/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        senior: {
          deep: '#1a4a3a',
          gold: '#c9a84c',
          cream: '#f5f0e8',
          text: '#2d2d2d',
        },
        maman: {
          rose: '#e8b4b8',
          soft: '#fce4ec',
          warm: '#f8e8e0',
          text: '#4a2c2c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      // ============================================================
      // ✅ ANIMATIONS MANQUANTES
      // ============================================================
      // L'application utilisait déjà ces classes un peu partout :
      //   animate-fadeIn  → 56 usages
      //   animate-slideUp →  5 usages
      //   animate-slideIn →  2 usages
      //   animate-scaleIn →  1 usage
      // ... mais elles n'étaient définies NULLE PART. Tailwind ne générait
      // donc aucune règle CSS et les animations ne se produisaient jamais :
      // modales, menus et pages apparaissaient d'un coup, sans transition.
      // C'est ce qui donnait cette impression de « saut » à chaque écran.
      //
      // Durées volontairement courtes (200-250 ms) : au-delà, une interface
      // paraît lente plutôt que fluide.
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out',
        slideUp: 'slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideIn: 'slideIn 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        scaleIn: 'scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};