// Planetary Eats — shared design tokens.
// Black, white and gray everywhere in the app UI: a black stage that the 3D
// globe (the one place color lives — real textures, atmosphere glow) pops
// against. Every screen pulls from here, so the theme is changed in this one
// file. Names are by role, not by hue: `forest` is the primary action color
// (white on black), `onPrimary` is what sits on top of it, `cream` is the page.

export const colors = {
  // Core brand
  forest: '#FFFFFF', // primary — CTAs, price tags, active states
  leaf: '#BDBDBD', // secondary, light gray
  sun: '#D0D0D0', // accent (badges, highlights)
  clay: '#A8A8A8', // secondary accent

  // Neutrals
  cream: '#000000', // app background — black
  card: '#171717', // raised surfaces
  ink: '#F5F5F5', // primary text
  inkMuted: '#A3A3A3', // secondary text
  border: '#2B2B2B',

  // Status — distinguished by lightness only, no hue.
  success: '#E6E6E6',
  danger: '#9A9A9A',

  // Text / icons that sit on top of a `forest` (primary) surface.
  onPrimary: '#000000',
  onPrimaryMuted: 'rgba(0,0,0,0.7)',
  // A true white, for the rare thing that must stay white on any theme.
  white: '#FFFFFF',
} as const;

export const fonts = {
  heading: 'Fraunces, Georgia, serif',
  body: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 30, fontWeight: '600' as const, color: colors.ink, fontFamily: fonts.heading },
  h2: { fontSize: 23, fontWeight: '600' as const, color: colors.ink, fontFamily: fonts.heading },
  h3: { fontSize: 18, fontWeight: '600' as const, color: colors.ink, fontFamily: fonts.heading },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.ink, fontFamily: fonts.body },
  bodyMuted: { fontSize: 14, fontWeight: '400' as const, color: colors.inkMuted, fontFamily: fonts.body },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.inkMuted, fontFamily: fonts.body },
  price: { fontSize: 15, fontWeight: '700' as const, color: colors.forest, fontFamily: fonts.body },
};

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 2,
  },
};
