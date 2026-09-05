// CGM MEDISTAR Typography Scale
// WCAG 2.2 compliant with proper hierarchy

export const typography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',

  displayLarge: {
    fontSize: '3.5rem',
    fontWeight: 700,
    lineHeight: 1.12,
    letterSpacing: '-0.01562em',
  },
  displayMedium: {
    fontSize: '2.75rem',
    fontWeight: 600,
    lineHeight: 1.16,
    letterSpacing: '-0.00833em',
  },
  displaySmall: {
    fontSize: '2.25rem',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '0em',
  },

  h1: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: '0em',
  },
  h2: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.33,
    letterSpacing: '0em',
  },
  h3: {
    fontSize: '1.25rem',
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '0em',
  },
  h4: {
    fontSize: '1.125rem',
    fontWeight: 500,
    lineHeight: 1.44,
    letterSpacing: '0em',
  },
  h5: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0em',
  },
  h6: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.57,
    letterSpacing: '0.00714em',
  },

  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.00938em',
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.43,
    letterSpacing: '0.00714em',
  },

  subtitle1: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.00938em',
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.43,
    letterSpacing: '0.00714em',
  },

  caption: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.66,
    letterSpacing: '0.03333em',
  },
  overline: {
    fontSize: '0.625rem',
    fontWeight: 500,
    lineHeight: 2.66,
    letterSpacing: '0.08333em',
    textTransform: 'uppercase' as const,
  },

  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.75,
    letterSpacing: '0.02857em',
    textTransform: 'none' as const,
  },

  code: {
    fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
    fontSize: '0.875rem',
    fontWeight: 400,
  },

  czech: {
    lineHeight: 1.6,
  },
};

export const fontSizeScale = {
  '2xs': '0.625rem',
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
};

export const lineHeightScale = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
};
