import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// Every colour is a CSS variable defined in src/styles/theme.css (Material 3
// roles), so the whole look can be changed in one place and dark mode is just
// a variable swap.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const tone = (name: string) => ({ DEFAULT: v(`tone-${name}`), ink: v(`tone-${name}-ink`) });

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        panel: v('panel'),
        surface: v('surface'),
        raised: v('raised'),
        border: v('border'),
        outline: v('outline'),
        ink: v('ink'),
        muted: v('muted'),
        accent: {
          DEFAULT: v('accent'),
          strong: v('accent-strong'),
          hover: v('accent-hover'),
          fg: v('accent-fg'),
          ink: v('accent-ink'),
          soft: v('accent-soft'),
          container: v('accent-container'),
          'on-container': v('on-accent-container'),
        },
        clay: { DEFAULT: v('clay'), ink: v('clay-ink'), soft: v('clay-soft') },
        amber: { DEFAULT: v('amber'), ink: v('amber-ink'), soft: v('amber-soft') },
        danger: { DEFAULT: v('danger'), fg: v('danger-fg'), soft: v('danger-soft') },
        inverse: { DEFAULT: v('inverse-surface'), ink: v('inverse-ink') },
        tone: {
          green: tone('green'),
          blue: tone('blue'),
          violet: tone('violet'),
          orange: tone('orange'),
          yellow: tone('yellow'),
          rose: tone('rose'),
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      fontSize: {
        // Journal and note body text.
        prose: ['1.0625rem', { lineHeight: '1.7' }],
      },
      // Material 3 shape scale: cards 24, fields 12, chips 8, sheets 28.
      borderRadius: { card: '24px', input: '12px', chip: '8px', sheet: '28px' },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        lift: 'var(--shadow-lift)',
      },
      transitionDuration: { DEFAULT: '150ms' },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
        tabbar: '5rem',
      },
      maxWidth: { content: '46rem', wide: '76rem' },
      gridTemplateColumns: { 14: 'repeat(14, minmax(0, 1fr))' },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        pop: { '0%': { transform: 'scale(0.6)' }, '60%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        burst: {
          '0%': { opacity: '0', transform: 'translate(0,0) scale(0.4)' },
          '20%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translate(var(--bx), var(--by)) scale(1)' },
        },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 240ms cubic-bezier(0.2, 0, 0, 1) both',
        pop: 'pop 320ms cubic-bezier(0.2, 0, 0, 1)',
        shimmer: 'shimmer 1.6s linear infinite',
        burst: 'burst 900ms cubic-bezier(0.2, 0, 0, 1) forwards',
        'scale-in': 'scale-in 160ms cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [typography],
} satisfies Config;
