/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fredoka', 'system-ui', 'sans-serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#1e1b4b',
        grape: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 900: '#2e1065' },
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.85)', opacity: 0 }, '60%': { transform: 'scale(1.04)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        slideup: { '0%': { transform: 'translateY(16px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        wiggle: { '0%,100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: 0.9 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
      },
      animation: {
        pop: 'pop .35s cubic-bezier(.2,1.4,.4,1) both',
        floaty: 'floaty 4s ease-in-out infinite',
        slideup: 'slideup .35s ease-out both',
        wiggle: 'wiggle 1.2s ease-in-out infinite',
        pulseRing: 'pulseRing 1.2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
