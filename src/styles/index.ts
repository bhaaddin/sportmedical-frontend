// CGM MEDISTAR Styles Index

// CSS imports (add to main.tsx):
// import './styles/reset.css';
// import './styles/variables.css';
// import './styles/accessibility.css';
// import './styles/print.css';

// Theme
export { default as theme } from '../theme';
export { colors, roleColors, serviceColors, priorityColors } from '../theme/colors';
export { typography, fontSizeScale, lineHeightScale } from '../theme/typography';
export {
  spacing, breakpoints, containers, grid,
  zIndex, borderRadius, shadows, transitions,
} from '../theme/spacing';

// Responsive utilities
export { responsive, mediaQueries, patterns } from './responsive';

// Animation utilities
export { keyframes, animations, cssTransitions as animationTransitions, hoverEffects } from './animations';

// Dark mode
export { darkModeColors, darkModeTheme, useDarkMode } from './darkMode';

// Theme provider
export { ThemeProvider, useThemeMode } from '../providers/ThemeProvider';

// Theme hook
export { useTheme } from '../hooks/useTheme';
