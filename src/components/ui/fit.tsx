import { Box, type BoxProps, type SxProps, type Theme } from '@mui/material';
import { useIsPhone } from '../../layout/useDevice';

/*
 * A screen is exactly as tall as the window (App's Layout: the area under the line of place is a region of its own),
 * so a page that wants to fit arranges itself in that region instead of growing past it:
 *
 *   <FitPage>                   the page's root - fills the region (a phone's page just flows; the region scrolls it)
 *     header, KPI row, filters  natural height, never shrunk
 *     <FitBody>                 takes the rest; a grid of panels, or one table
 *       <FitPanel title=..>     a panel with a head and a body of its own that scrolls
 *
 * The document never scrolls. A list, a feed or a table scrolls INSIDE its panel, so the width (columns) and the height
 * are both used. A phone (<768) is not forced into the window's height: its panels stack and the region scrolls, like a
 * native app's content area between its bars.
 */

/** The one thing that may scroll: a region whose parent gave it a definite height (`minHeight: 0` lets it shrink). */
export const FIT_SCROLL_SX = {
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
} as const;

/**
 * A table that scrolls inside a box keeps its head in view. Put it on the scrolling box (the TableContainer or the Box
 * around the table); the cells get the paper colour so rows slide under them.
 */
export const STICKY_HEAD_SX = {
  '& thead th, & .MuiTableHead-root .MuiTableCell-root': {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    backgroundColor: 'background.paper',
  },
} as const;

/** A flex item that takes what is left of its column and lets its own content scroll. */
export const FIT_FILL_SX = { flex: '1 1 0', minHeight: 0 } as const;

/**
 * The sx of a card that takes what is left of its column (tablet and desktop) and lays its table out in a scroll box of
 * its own: `<SoftCard sx={fitCardSx(phone)}><TableContainer sx={fitTableSx(phone)}><Table stickyHeader={!phone}>`.
 * A phone's card keeps its natural height (the region scrolls it).
 */
export const fitCardSx = (phone: boolean) => (phone ? {} : { ...FIT_FILL_SX, display: 'flex', flexDirection: 'column' });
export const fitTableSx = (phone: boolean) => (phone ? {} : { ...FIT_FILL_SX, overflow: 'auto', overscrollBehavior: 'contain' });

export function FitPage({ sx, children, ...rest }: BoxProps) {
  const phone = useIsPhone();
  return (
    <Box
      data-fit-page=""
      sx={[
        { display: 'flex', flexDirection: 'column', minWidth: 0, ...(phone ? {} : FIT_FILL_SX) },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** What is left under the page's header. On a phone it is simply the next block. `scroll`: the body scrolls as one. */
export function FitBody({ sx, children, scroll = false, ...rest }: BoxProps & { scroll?: boolean }) {
  const phone = useIsPhone();
  return (
    <Box sx={[{ minWidth: 0, ...(phone ? {} : { ...FIT_FILL_SX, display: 'flex', flexDirection: 'column', ...(scroll ? FIT_SCROLL_SX : {}) }) }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} {...rest}>
      {children}
    </Box>
  );
}

/** A panel that fits its cell: the head stays, the body scrolls. */
export function FitPanel({
  head,
  children,
  bodySx,
  sx,
  ...rest
}: Omit<BoxProps, 'title'> & { head?: React.ReactNode; bodySx?: SxProps<Theme> }) {
  const phone = useIsPhone();
  return (
    <Box
      sx={[
        { display: 'flex', flexDirection: 'column', minWidth: 0, ...(phone ? {} : { minHeight: 0, height: '100%' }) },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {head}
      <Box sx={[phone ? {} : { ...FIT_FILL_SX, ...FIT_SCROLL_SX }, ...(Array.isArray(bodySx) ? bodySx : bodySx ? [bodySx] : [])]}>{children}</Box>
    </Box>
  );
}
