// Responsive utility functions for styled-components and MUI sx prop

export const responsive = {
  hideBelow: (breakpoint: string) => ({
    display: { xs: 'none', [breakpoint]: 'block' },
  }),

  hideAbove: (breakpoint: string) => ({
    display: { [breakpoint]: 'none', xs: 'block' },
  }),

  showOnly: (breakpoint: string) => ({
    display: { xs: 'none', [breakpoint]: 'block' },
  }),

  fontSize: {
    xs: { fontSize: '0.75rem' },
    sm: { fontSize: '0.875rem' },
    md: { fontSize: '1rem' },
    lg: { fontSize: '1.125rem' },
    xl: { fontSize: '1.25rem' },
  },

  padding: {
    xs: { p: 2 },
    sm: { p: 3 },
    md: { p: 4 },
    lg: { p: 5 },
    xl: { p: 6 },
  },

  margin: {
    xs: { m: 2 },
    sm: { m: 3 },
    md: { m: 4 },
    lg: { m: 5 },
    xl: { m: 6 },
  },

  container: {
    sm: { maxWidth: 600, mx: 'auto' },
    md: { maxWidth: 900, mx: 'auto' },
    lg: { maxWidth: 1200, mx: 'auto' },
    xl: { maxWidth: 1536, mx: 'auto' },
  },

  grid: {
    autoFit: (minWidth = 250) => ({
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        sm: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
      },
      gap: 3,
    }),
    columns: (cols: { xs?: number; sm?: number; md?: number; lg?: number }) => ({
      display: 'grid',
      gridTemplateColumns: {
        xs: `repeat(${cols.xs || 1}, 1fr)`,
        sm: `repeat(${cols.sm || cols.xs || 1}, 1fr)`,
        md: `repeat(${cols.md || cols.sm || cols.xs || 1}, 1fr)`,
        lg: `repeat(${cols.lg || cols.md || cols.sm || cols.xs || 1}, 1fr)`,
      },
      gap: 3,
    }),
  },
};

export const mediaQueries = {
  sm: '@media (min-width: 600px)',
  md: '@media (min-width: 900px)',
  lg: '@media (min-width: 1200px)',
  xl: '@media (min-width: 1536px)',
};

export const patterns = {
  stackToRow: {
    flexDirection: { xs: 'column' as const, md: 'row' as const },
  },
  fullWidth: {
    width: { xs: '100%', md: 'auto' },
  },
  desktopOnly: {
    display: { xs: 'none', md: 'block' },
  },
  mobileOnly: {
    display: { xs: 'block', md: 'none' },
  },
};
