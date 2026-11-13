// Design tokens: the fixed set of sizes every screen draws from, so spacing,
// corner radii and type sizes cannot drift between screens.

/** 4-point spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Apple's minimum comfortable touch target. */
export const HIT_TARGET = 44;

export const type = {
  screenTitle: 22, // pushed-screen header
  largeTitle: 30,  // tab-screen header
  heading: 17,
  body: 15,
  label: 13,
  caption: 11,
} as const;

/** Colours with one meaning each, the same in light and dark themes. */
export const semantic = {
  positive: '#10B981', // money in, spending down
  negative: '#EF4444', // over budget, spending up
  warning: '#F59E0B',
  info: '#3B82F6',
} as const;
