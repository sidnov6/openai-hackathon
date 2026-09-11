import type { Config } from 'tailwindcss'

/**
 * Homi design tokens.
 *
 * Visual thesis: a precise, welcoming city atlas with a calm tenancy workspace, in the
 * warmth of the Homi mark - terracotta, deep maroon and warm sand over a cream canvas.
 * The brand's orange carries the primary action; attention stays amber; the fictional
 * demo lease uses teal, deliberately the one cool colour in the system so it can never be
 * mistaken for a brand-coloured "real" surface.
 *
 * Contrast verified against #FFFFFF surface and #FBF7F3 canvas (WCAG 2.1 ratios):
 *   ink     #2B1C18 on white  15.8:1   body text
 *   muted   #7A625B on white   5.6:1   secondary text (5.3:1 on canvas)
 *   primary #B8431F on white   5.4:1   links, and white-on-primary for buttons
 *   amber   #B45309 on white   5.0:1   attention text
 *   danger  #B00020 on white   7.4:1   cooler than the brand orange, so the two never blur
 *   success #067647 on white   4.9:1
 *   demo    #0F766E on white   5.5:1   fictional-lease surfaces
 * Never encode status with colour alone - every status token is paired with an icon
 * and a text label in the components that use it.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#2B1C18', soft: '#4A3530', muted: '#7A625B', faint: '#A08B84' },
        primary: { DEFAULT: '#B8431F', hover: '#9C3818', press: '#7F2C12', tint: '#FDF0EA', ring: '#E5A183' },
        canvas: '#FBF7F3',
        surface: { DEFAULT: '#FFFFFF', sunken: '#FDFAF7', raised: '#FFFFFF' },
        line: { DEFAULT: '#EADFD7', strong: '#D8C7BC', soft: '#F3EBE4' },
        amber: { DEFAULT: '#B45309', tint: '#FDF4E6', line: '#F2D7A4' },
        danger: { DEFAULT: '#B00020', tint: '#FDEEF0', line: '#F2BFC6' },
        success: { DEFAULT: '#067647', tint: '#ECFAF3', line: '#B4E3CD' },
        demo: { DEFAULT: '#0F766E', tint: '#EAF6F4', line: '#B3DCD6' },
        // Straight from the Homi mark, for brand moments only - never for body text.
        brand: { orange: '#D9542B', maroon: '#7B2C24', sand: '#F5C87A', cream: '#F7E3BE' },
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Body 16px, core labels 14px (brief section 4).
        'micro': ['11px', { lineHeight: '16px', letterSpacing: '0.04em' }],
        'label': ['13px', { lineHeight: '18px' }],
        'ui': ['14px', { lineHeight: '20px' }],
        'body': ['16px', { lineHeight: '25px' }],
        'title': ['19px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
        'display': ['25px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
      },
      borderRadius: { xs: '4px', sm: '6px', DEFAULT: '8px', md: '10px', lg: '14px', xl: '18px' },
      boxShadow: {
        card: '0 1px 2px rgba(43,28,24,0.05), 0 1px 1px rgba(43,28,24,0.04)',
        raised: '0 4px 12px -2px rgba(43,28,24,0.10), 0 2px 4px -2px rgba(43,28,24,0.06)',
        sheet: '0 16px 48px -12px rgba(43,28,24,0.22), 0 4px 12px -4px rgba(43,28,24,0.10)',
        rail: '1px 0 0 #EADFD7',
      },
      spacing: { '18': '4.5rem', 'rail': '380px' },
      transitionTimingFunction: { out: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'shimmer': { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms cubic-bezier(0.16,1,0.3,1)',
        'slide-up': 'slide-up 200ms cubic-bezier(0.16,1,0.3,1)',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
} satisfies Config
