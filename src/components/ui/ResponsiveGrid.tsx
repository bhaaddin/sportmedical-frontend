import { ReactNode } from 'react';
import { Box } from '@mui/material';

interface ResponsiveGridProps {
  children: ReactNode;
  columns?: { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  spacing?: number;
  minItemWidth?: number;
  autoFit?: boolean;
}

export default function ResponsiveGrid({ children, columns = { xs: 1, sm: 2, md: 3, lg: 4 }, spacing = 3, minItemWidth, autoFit = false }: ResponsiveGridProps) {
  if (autoFit && minItemWidth) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))`, gap: spacing }}>
        {children}
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: `repeat(${columns.xs || 1}, 1fr)`,
        sm: `repeat(${columns.sm || columns.xs || 1}, 1fr)`,
        md: `repeat(${columns.md || columns.sm || columns.xs || 1}, 1fr)`,
        lg: `repeat(${columns.lg || columns.md || columns.sm || columns.xs || 1}, 1fr)`,
      },
      gap: spacing,
    }}>
      {children}
    </Box>
  );
}
