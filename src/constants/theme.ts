// Planetary Eats — shared design tokens.
// Monochrome palette: black, white and gray everywhere in the app UI. The
// only place color survives is the 3D globe itself (real photo textures,
// atmosphere glow) — that's a deliberate exception, not an oversight. Every
// screen pulls from here so a rebrand only touches this one file.

export const colors = {
  // Core brand
  forest: '#1A1A1A', // primary — near-black (CTAs, price tags, active states)
  leaf: '#4D4D4D', // secondary, mid gray
  sun: '#404040', // accent (badges, highlights)
  clay: '#595959', // secondary accent

  // Neutrals
  cream: '#FFFFFF', // app background — plain white
  card: '#F3F3F3',
  ink: '#111111', // primary text — near-black
  inkMuted: '#6B6B6B', // secondary text — gray
  border: '#E0E0E0',

  // Status — distinguished by lightness only, no hue. Both are dark enough
  // to keep white button-text and text-on-white readable at AA contrast.
  success: '#1F1F1F',
  danger: '#666666',

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
