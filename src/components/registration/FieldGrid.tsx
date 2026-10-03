import { Box, type SxProps, type Theme } from '@mui/material';
import { useDevice } from '../../layout/useDevice';

/**
 * The grid every registration card lays its fields on (brief, rule 3).
 *
 *   phone    one field per row, always
 *   tablet   portrait one column, landscape two
 *   desktop  two columns, as drawn
 *
 * Plain CSS grid, no JavaScript width maths: `auto-fit` with a minimum of 40 %
 * can never make a third column, and the portrait media query is what keeps an
 * iPad held upright at one. `data-layout` says which rule applies so a test
 * (or a reader of the DOM) does not have to guess it from the styles.
 */
export type FieldGridLayout = 'single' | 'auto';

const TWO_COLUMNS_AT_MOST = 'repeat(auto-fit, minmax(max(260px, 40%), 1fr))';

export function FieldGrid({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}) {
  const device = useDevice();
  const layout: FieldGridLayout = device === 'phone' ? 'single' : 'auto';

  return (
    <Box
      data-layout={layout}
      data-device={device}
      sx={[
        {
          display: 'grid',
          gap: 2,
          gridTemplateColumns: layout === 'single' ? '1fr' : TWO_COLUMNS_AT_MOST,
          '@media (min-width: 768px) and (max-width: 1279px) and (orientation: portrait)': {
            gridTemplateColumns: '1fr',
          },
          '& > *': { minWidth: 0 },
        },
        ...(Array.isArray(sx) ? sx : sx === undefined ? [] : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/** A cell of the grid. `full` spans every column (a note, a picker, a wide field). */
export function FieldCell({
  full = false,
  children,
}: {
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box data-span={full ? 'full' : undefined} sx={full ? { gridColumn: '1 / -1' } : undefined}>
      {children}
    </Box>
  );
}

export default FieldGrid;
