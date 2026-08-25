// Planetary Eats — shared design tokens.
// Warm, organic wellness palette: cream and sage instead of dark sci-fi
// space tones. Every screen pulls from here so a rebrand only touches this
// one file.

export const colors = {
  // Core brand
  forest: '#3F6B4C', // primary — warm sage-forest (CTAs, price tags, active states)
  leaf: '#6B9C74', // secondary, lighter sage
  sun: '#DFA24E', // accent — warm gold (badges, highlights)
  clay: '#C1694A', // secondary accent — terracotta

  // Neutrals
  cream: '#FAF3E6', // app background — warm cream, not stark white or dark
  card: '#FFFDF8',
  ink: '#2E2A22', // primary text — warm near-black
  inkMuted: '#7C7466', // secondary text — warm gray-brown
  border: '#E7DCC8',

  // Status
  success: '#3F6B4C',
  danger: '#B65540',

  // Convenience
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
    shadowColor: '#3A2E1E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
};
