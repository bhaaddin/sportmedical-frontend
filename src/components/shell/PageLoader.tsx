import { Box, Typography, CircularProgress } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { isPlannerRoute } from './plannerRoutes';
import { RAIL_WIDTH, SIDEBAR_WIDTH, sideGlass } from './shellStyles';

/* ── Loading spinner for Suspense ── */
export function PageLoader() {
  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', gap: 1.5,
        justifyContent: 'center', alignItems: 'center', minHeight: '50vh',
      }}
    >
      <CircularProgress size={40} color="primary" />
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
        SPORTMEDICAL
      </Typography>
    </Box>
  );
}

/**
 * What stands in for the staff portal while its script arrives (App.tsx): the empty frame of the navigation
 * (the sidebar on a desktop, the rail on a tablet, nothing on a phone, nothing on the planner's own full-screen
 * routes) around the same spinner. The shell then appears in place instead of replacing a bare spinner, so
 * nothing jumps when it arrives.
 */
export function StaffShellPlaceholder() {
  const { pathname } = useLocation();
  const framed = !isPlannerRoute(pathname);
  return (
    <>
      {framed && (
        <Box
          aria-hidden
          data-testid="staff-shell-placeholder"
          sx={(t) => ({
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            boxSizing: 'border-box',
            display: 'none',
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            '@media (min-width: 768px)': { display: 'block', width: RAIL_WIDTH },
            '@media (min-width: 1280px)': { width: SIDEBAR_WIDTH },
            ...sideGlass(t),
          })}
        />
      )}
      <Box
        sx={framed ? { '@media (min-width: 768px)': { ml: `${RAIL_WIDTH}px` }, '@media (min-width: 1280px)': { ml: `${SIDEBAR_WIDTH}px` } } : undefined}
      >
        <PageLoader />
      </Box>
    </>
  );
}
